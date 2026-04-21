-- ============================================================
-- Ejecutar en Supabase Studio → SQL Editor
-- ============================================================

-- Agrega sistema de amortización y cuota en UVA a pasivos
ALTER TABLE public.pasivos
  ADD COLUMN IF NOT EXISTS sistema_amortizacion TEXT DEFAULT 'frances',
  ADD COLUMN IF NOT EXISTS cuota_uva NUMERIC(18,6);

-- Valores válidos: 'frances' | 'aleman' | 'uva' | 'bullet' | 'variable' | 'otro'
