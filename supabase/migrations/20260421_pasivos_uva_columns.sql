-- Columns added to public.pasivos for the UVA amortization work.
-- Moved out of the repo root and re-encoded from UTF-16 to UTF-8.

ALTER TABLE public.pasivos ADD COLUMN IF NOT EXISTS sistema_amortizacion TEXT DEFAULT 'frances';
ALTER TABLE public.pasivos ADD COLUMN IF NOT EXISTS cuota_uva NUMERIC(18,4);
ALTER TABLE public.pasivos ADD COLUMN IF NOT EXISTS capital_uva NUMERIC(18,2);
ALTER TABLE public.pasivos ADD COLUMN IF NOT EXISTS n_cuotas INTEGER;
