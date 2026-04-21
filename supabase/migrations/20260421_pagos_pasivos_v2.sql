-- ============================================================
-- Ejecutar en Supabase Studio → SQL Editor
-- Agrega columnas para el desglose capital/interés en cada pago
-- ============================================================

ALTER TABLE public.pagos_pasivos
  ADD COLUMN IF NOT EXISTS cuota_numero        INTEGER,        -- número de cuota (1-based)
  ADD COLUMN IF NOT EXISTS capital_uva_pagado  NUMERIC(18,4),  -- UVAs de capital amortizadas
  ADD COLUMN IF NOT EXISTS interes_uva_pagado  NUMERIC(18,4);  -- UVAs de interés pagadas
