-- ============================================================
-- Ejecutar en Supabase Studio → SQL Editor
-- ============================================================

-- Tabla instrumentos (activos financieros y no financieros)
CREATE TABLE IF NOT EXISTS public.instrumentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  tipo         TEXT NOT NULL DEFAULT 'otro',
  descripcion  TEXT,
  activo       BOOLEAN NOT NULL DEFAULT true,
  es_sistema   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.instrumentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios ven sus instrumentos y los del sistema"
  ON public.instrumentos FOR SELECT
  USING (usuario_id = auth.uid() OR es_sistema = true);

CREATE POLICY "usuarios insertan sus instrumentos"
  ON public.instrumentos FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "usuarios actualizan sus instrumentos"
  ON public.instrumentos FOR UPDATE
  USING (usuario_id = auth.uid());

-- Tabla valuaciones (snapshots de valor por instrumento)
CREATE TABLE IF NOT EXISTS public.valuaciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrumento_id  UUID NOT NULL REFERENCES public.instrumentos(id) ON DELETE CASCADE,
  objetivo_id     UUID REFERENCES public.objetivos(id) ON DELETE SET NULL,
  fecha           DATE NOT NULL,
  monto           NUMERIC(18,2) NOT NULL,
  moneda          TEXT NOT NULL DEFAULT 'ARS',
  tipo_cambio     NUMERIC(12,4),
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.valuaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios ven sus valuaciones"
  ON public.valuaciones FOR SELECT
  USING (usuario_id = auth.uid());

CREATE POLICY "usuarios insertan sus valuaciones"
  ON public.valuaciones FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "usuarios actualizan sus valuaciones"
  ON public.valuaciones FOR UPDATE
  USING (usuario_id = auth.uid());

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_valuaciones_usuario_fecha
  ON public.valuaciones (usuario_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_valuaciones_instrumento
  ON public.valuaciones (instrumento_id);
