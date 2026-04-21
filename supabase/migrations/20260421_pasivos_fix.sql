-- ============================================================
-- Ejecutar en Supabase Studio → SQL Editor
-- ============================================================

-- Agregar columnas faltantes a la tabla 'pasivos' para soportar los cálculos del Simulador de UVA
ALTER TABLE public.pasivos ADD COLUMN IF NOT EXISTS sistema_amortizacion TEXT DEFAULT 'frances';
ALTER TABLE public.pasivos ADD COLUMN IF NOT EXISTS cuota_uva NUMERIC(18,4);
ALTER TABLE public.pasivos ADD COLUMN IF NOT EXISTS capital_uva NUMERIC(18,2);
ALTER TABLE public.pasivos ADD COLUMN IF NOT EXISTS n_cuotas INTEGER;
