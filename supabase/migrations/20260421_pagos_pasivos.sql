-- ============================================================
-- Ejecutar en Supabase Studio → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pagos_pasivos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pasivo_id        UUID NOT NULL REFERENCES public.pasivos(id) ON DELETE CASCADE,
  usuario_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha            DATE NOT NULL,
  monto_ars        NUMERIC(18,2) NOT NULL,
  uva_valor        NUMERIC(12,4),          -- valor UVA al momento del pago
  uva_equivalente  NUMERIC(18,4),          -- cuántas UVAs se amortizaron (monto_ars / uva_valor)
  descripcion      TEXT,
  cuenta_id        UUID REFERENCES public.cuentas(id) ON DELETE SET NULL,
  categoria_id     UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pagos_pasivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver propios pagos"      ON public.pagos_pasivos FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "insertar propios pagos" ON public.pagos_pasivos FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "actualizar propios pagos" ON public.pagos_pasivos FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY "borrar propios pagos"   ON public.pagos_pasivos FOR DELETE USING (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pagos_pasivos_pasivo ON public.pagos_pasivos (pasivo_id, fecha DESC);
