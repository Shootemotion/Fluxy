-- ============================================================
-- Ejecutar en Supabase Studio → SQL Editor
-- Tabla para Plazos Fijos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plazos_fijos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entidad              TEXT NOT NULL,               -- nombre del banco
  monto_inicial        NUMERIC(18,2) NOT NULL,
  tasa_tna             NUMERIC(6,2) NOT NULL,       -- TNA en % (ej: 110.00)
  plazo_dias           INTEGER NOT NULL,            -- días del plazo (ej: 30, 60, 180)
  fecha_inicio         DATE NOT NULL,
  fecha_vencimiento    DATE NOT NULL,               -- calculado: fecha_inicio + plazo_dias
  moneda               TEXT NOT NULL DEFAULT 'ARS',
  renovacion_automatica BOOLEAN NOT NULL DEFAULT false,
  notas                TEXT,
  estado               TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'vencido', 'cancelado')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plazos_fijos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver propios plazos"      ON public.plazos_fijos FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "insertar propios plazos" ON public.plazos_fijos FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "actualizar propios plazos" ON public.plazos_fijos FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY "borrar propios plazos"   ON public.plazos_fijos FOR DELETE USING (usuario_id = auth.uid());
