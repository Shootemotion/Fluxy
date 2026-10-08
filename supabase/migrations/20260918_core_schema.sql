-- ============================================================================
-- Fluxy — core schema
--
-- These tables predate the migrations folder: they were created by hand in the
-- Supabase dashboard, so the project could not be rebuilt from source. This
-- file closes that gap.
--
-- It is written to be safe to run against the EXISTING database: every
-- statement is idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS), so it
-- changes nothing where the object already exists and creates it where it does
-- not. Run it once against production to confirm the two agree, and it becomes
-- the starting point for any fresh environment.
--
-- Reconstructed from src/lib/supabase/types.ts and the queries in
-- src/lib/actions.ts. If a column here disagrees with production, production
-- wins — fix this file, not the database.
-- ============================================================================

-- ─── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  nombre            TEXT,
  avatar_url        TEXT,
  configuracion     JSONB NOT NULL DEFAULT '{}'::jsonb,
  moneda_principal  TEXT NOT NULL DEFAULT 'ARS',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios ven su perfil" ON public.profiles;
CREATE POLICY "usuarios ven su perfil"
  ON public.profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "usuarios actualizan su perfil" ON public.profiles;
CREATE POLICY "usuarios actualizan su perfil"
  ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Every new auth user gets a profile row automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'nombre',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── monedas (shared reference data) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monedas (
  codigo     TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  simbolo    TEXT NOT NULL,
  decimales  INTEGER NOT NULL DEFAULT 2,
  activa     BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.monedas (codigo, nombre, simbolo, decimales) VALUES
  ('ARS', 'Peso argentino', '$',   2),
  ('USD', 'Dolar',          'U$S', 2)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE public.monedas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monedas son publicas" ON public.monedas;
CREATE POLICY "monedas son publicas"
  ON public.monedas FOR SELECT TO authenticated USING (true);

-- ─── cuentas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cuentas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  tipo           TEXT NOT NULL DEFAULT 'banco',
  moneda         TEXT NOT NULL DEFAULT 'ARS',
  saldo_inicial  NUMERIC(18,2) NOT NULL DEFAULT 0,
  color          TEXT NOT NULL DEFAULT '#6C63FF',
  icono          TEXT,
  activa         BOOLEAN NOT NULL DEFAULT true,
  orden          INTEGER NOT NULL DEFAULT 0,
  cbu            TEXT,
  alias          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cuentas ADD COLUMN IF NOT EXISTS cbu   TEXT;
ALTER TABLE public.cuentas ADD COLUMN IF NOT EXISTS alias TEXT;
ALTER TABLE public.cuentas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios gestionan sus cuentas" ON public.cuentas;
CREATE POLICY "usuarios gestionan sus cuentas"
  ON public.cuentas FOR ALL
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_cuentas_usuario ON public.cuentas (usuario_id, orden);

-- ─── categorias ──────────────────────────────────────────────────────────────
-- usuario_id IS NULL marks a shared system category.
CREATE TABLE IF NOT EXISTS public.categorias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'gasto',
  icono       TEXT,
  color       TEXT NOT NULL DEFAULT '#6C63FF',
  es_sistema  BOOLEAN NOT NULL DEFAULT false,
  activa      BOOLEAN NOT NULL DEFAULT true,
  orden       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios ven sus categorias y las del sistema" ON public.categorias;
CREATE POLICY "usuarios ven sus categorias y las del sistema"
  ON public.categorias FOR SELECT
  USING (usuario_id = auth.uid() OR es_sistema = true);

DROP POLICY IF EXISTS "usuarios crean sus categorias" ON public.categorias;
CREATE POLICY "usuarios crean sus categorias"
  ON public.categorias FOR INSERT
  WITH CHECK (usuario_id = auth.uid() AND es_sistema = false);

DROP POLICY IF EXISTS "usuarios actualizan sus categorias" ON public.categorias;
CREATE POLICY "usuarios actualizan sus categorias"
  ON public.categorias FOR UPDATE
  USING (usuario_id = auth.uid() AND es_sistema = false);

CREATE INDEX IF NOT EXISTS idx_categorias_usuario ON public.categorias (usuario_id, tipo);

-- ─── subcategorias ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subcategorias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id  UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  icono         TEXT,
  activa        BOOLEAN NOT NULL DEFAULT true,
  orden         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios ven subcategorias de sus categorias" ON public.subcategorias;
CREATE POLICY "usuarios ven subcategorias de sus categorias"
  ON public.subcategorias FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.categorias c
    WHERE c.id = categoria_id AND (c.usuario_id = auth.uid() OR c.es_sistema = true)
  ));

-- ─── objetivos ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.objetivos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre                   TEXT NOT NULL,
  descripcion              TEXT,
  monto_objetivo           NUMERIC(18,2) NOT NULL DEFAULT 0,
  saldo_actual             NUMERIC(18,2) NOT NULL DEFAULT 0,
  fecha_meta               DATE,
  prioridad                TEXT NOT NULL DEFAULT 'media',
  color                    TEXT NOT NULL DEFAULT '#6C63FF',
  icono                    TEXT,
  aporte_mensual_sugerido  NUMERIC(18,2),
  activo                   BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.objetivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios gestionan sus objetivos" ON public.objetivos;
CREATE POLICY "usuarios gestionan sus objetivos"
  ON public.objetivos FOR ALL
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Atomic contribution, so two concurrent aportes cannot overwrite each other.
-- Called from aportarAObjetivo() in src/lib/actions.ts.
CREATE OR REPLACE FUNCTION public.aportar_a_objetivo(p_objetivo_id UUID, p_monto NUMERIC)
RETURNS public.objetivos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  resultado public.objetivos;
BEGIN
  UPDATE public.objetivos
     SET saldo_actual = GREATEST(0, saldo_actual + p_monto),
         updated_at   = now()
   WHERE id = p_objetivo_id
     AND usuario_id = auth.uid()
  RETURNING * INTO resultado;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Objetivo no encontrado';
  END IF;

  RETURN resultado;
END;
$function$;

-- ─── movimientos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.movimientos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha              DATE NOT NULL,
  tipo               TEXT NOT NULL,
  categoria_id       UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  monto              NUMERIC(18,2) NOT NULL,
  moneda             TEXT NOT NULL DEFAULT 'ARS',
  tipo_cambio        NUMERIC(12,4),
  cuenta_origen_id   UUID REFERENCES public.cuentas(id) ON DELETE SET NULL,
  cuenta_destino_id  UUID REFERENCES public.cuentas(id) ON DELETE SET NULL,
  objetivo_id        UUID REFERENCES public.objetivos(id) ON DELETE SET NULL,
  descripcion        TEXT,
  comentario         TEXT,
  metodo_carga       TEXT NOT NULL DEFAULT 'manual',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.movimientos ADD COLUMN IF NOT EXISTS comentario TEXT;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios gestionan sus movimientos" ON public.movimientos;
CREATE POLICY "usuarios gestionan sus movimientos"
  ON public.movimientos FOR ALL
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Balances scan every movement of a user; the list view pages by date.
CREATE INDEX IF NOT EXISTS idx_movimientos_usuario_fecha
  ON public.movimientos (usuario_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_cuenta_origen
  ON public.movimientos (cuenta_origen_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_cuenta_destino
  ON public.movimientos (cuenta_destino_id);

-- ─── valuaciones ─────────────────────────────────────────────────────────────
-- Append-only log of "what is this asset worth today". There is deliberately
-- no es_ultima flag: the current value is the most recent row per instrument
-- (see getLatestValuations() in src/lib/actions.ts).
--
-- NOTE: supabase/migrations/20260420_instrumentos_valuaciones.sql describes an
-- earlier, different shape of this table (instrumento_id plus a separate
-- instrumentos table). Production uses the shape below; that file is kept for
-- history only and this is the authoritative definition.
CREATE TABLE IF NOT EXISTS public.valuaciones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha               DATE NOT NULL,
  instrumento_nombre  TEXT NOT NULL,
  monto               NUMERIC(18,2) NOT NULL,
  moneda              TEXT NOT NULL DEFAULT 'ARS',
  tipo_cambio         NUMERIC(12,4),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.valuaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios gestionan sus valuaciones" ON public.valuaciones;
CREATE POLICY "usuarios gestionan sus valuaciones"
  ON public.valuaciones FOR ALL
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_valuaciones_usuario_fecha
  ON public.valuaciones (usuario_id, fecha DESC);

-- ─── tipos_cambio ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tipos_cambio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           DATE NOT NULL,
  moneda_origen   TEXT NOT NULL,
  moneda_destino  TEXT NOT NULL,
  valor           NUMERIC(18,4) NOT NULL,
  fuente          TEXT NOT NULL DEFAULT 'api',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_cambio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tipos de cambio son publicos" ON public.tipos_cambio;
CREATE POLICY "tipos de cambio son publicos"
  ON public.tipos_cambio FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_tipos_cambio_par_fecha
  ON public.tipos_cambio (moneda_origen, moneda_destino, fecha DESC);
