-- ============================================================
-- Ejecutar en Supabase Studio → SQL Editor
-- Idempotente: DROP POLICY IF EXISTS antes de recrear
-- ============================================================

-- Reglas de alerta configuradas por el usuario
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  tipo         TEXT NOT NULL,
  operador     TEXT NOT NULL CHECK (operador IN ('<', '>', '<=', '>=')),
  valor        NUMERIC(18,2) NOT NULL,
  cuenta_id    UUID REFERENCES public.cuentas(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE CASCADE,
  objetivo_id  UUID REFERENCES public.objetivos(id) ON DELETE CASCADE,
  activa       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios ven sus reglas"      ON public.alert_rules;
DROP POLICY IF EXISTS "usuarios insertan reglas"     ON public.alert_rules;
DROP POLICY IF EXISTS "usuarios actualizan reglas"   ON public.alert_rules;
DROP POLICY IF EXISTS "usuarios borran reglas"       ON public.alert_rules;

CREATE POLICY "usuarios ven sus reglas"      ON public.alert_rules FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "usuarios insertan reglas"     ON public.alert_rules FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "usuarios actualizan reglas"   ON public.alert_rules FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY "usuarios borran reglas"       ON public.alert_rules FOR DELETE USING (usuario_id = auth.uid());

-- Notificaciones generadas (disparos de reglas)
CREATE TABLE IF NOT EXISTS public.alertas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id      UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  tipo         TEXT NOT NULL DEFAULT 'info',
  mensaje      TEXT NOT NULL,
  leida        BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios ven sus alertas"      ON public.alertas;
DROP POLICY IF EXISTS "usuarios insertan alertas"     ON public.alertas;
DROP POLICY IF EXISTS "usuarios actualizan alertas"   ON public.alertas;
DROP POLICY IF EXISTS "usuarios borran alertas"       ON public.alertas;

CREATE POLICY "usuarios ven sus alertas"      ON public.alertas FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "usuarios insertan alertas"     ON public.alertas FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "usuarios actualizan alertas"   ON public.alertas FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY "usuarios borran alertas"       ON public.alertas FOR DELETE USING (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_alertas_usuario_leida ON public.alertas (usuario_id, leida, created_at DESC);

-- Posiciones de mercado (acciones, CEDEARs, cripto, etc.)
CREATE TABLE IF NOT EXISTS public.posiciones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker         TEXT NOT NULL,
  nombre         TEXT,
  cantidad       NUMERIC(18,6) NOT NULL DEFAULT 0,
  precio_compra  NUMERIC(18,4),
  moneda         TEXT NOT NULL DEFAULT 'USD',
  broker         TEXT,
  notas          TEXT,
  activa         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.posiciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios ven sus posiciones"      ON public.posiciones;
DROP POLICY IF EXISTS "usuarios insertan posiciones"     ON public.posiciones;
DROP POLICY IF EXISTS "usuarios actualizan posiciones"   ON public.posiciones;
DROP POLICY IF EXISTS "usuarios borran posiciones"       ON public.posiciones;

CREATE POLICY "usuarios ven sus posiciones"      ON public.posiciones FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "usuarios insertan posiciones"     ON public.posiciones FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "usuarios actualizan posiciones"   ON public.posiciones FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY "usuarios borran posiciones"       ON public.posiciones FOR DELETE USING (usuario_id = auth.uid());
