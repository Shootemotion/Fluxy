-- ============================================================
-- Pagos en Cuotas
-- Añade soporte para rastrear cantidad de cuotas en recurrentes
-- ============================================================

ALTER TABLE public.recurrentes 
ADD COLUMN IF NOT EXISTS es_cuotas BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cuotas_totales INTEGER;
