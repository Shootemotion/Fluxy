-- ============================================================
-- Ejecutar en Supabase Studio → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pasivos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre            TEXT NOT NULL,
  tipo              TEXT NOT NULL DEFAULT 'prestamo',
  -- 'prestamo' | 'hipoteca' | 'tarjeta' | 'leasing' | 'otro'
  monto_original    NUMERIC(18,2) NOT NULL,
  saldo_pendiente   NUMERIC(18,2) NOT NULL,
  moneda            TEXT NOT NULL DEFAULT 'ARS',
  tasa_interes      NUMERIC(6,4) DEFAULT 0,
  cuota_mensual     NUMERIC(18,2),
  fecha_inicio      DATE,
  fecha_vencimiento DATE,
  notas             TEXT,
  activo            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pasivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios ven sus pasivos" ON public.pasivos FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "usuarios insertan pasivos" ON public.pasivos FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "usuarios actualizan pasivos" ON public.pasivos FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY "usuarios borran pasivos" ON public.pasivos FOR DELETE USING (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pasivos_usuario ON public.pasivos (usuario_id, activo);
