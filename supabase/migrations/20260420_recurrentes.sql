-- ============================================================
-- Gastos/Ingresos periódicos (recurrentes)
-- Ejecutar en Supabase Studio → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recurrentes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  monto        NUMERIC(18,2) NOT NULL,
  moneda       TEXT NOT NULL DEFAULT 'ARS',
  tipo         TEXT NOT NULL DEFAULT 'gasto',          -- 'gasto' | 'ingreso'
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  cuenta_id    UUID REFERENCES public.cuentas(id) ON DELETE SET NULL,
  dia_del_mes  SMALLINT NOT NULL DEFAULT 1 CHECK (dia_del_mes BETWEEN 1 AND 28),
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin    DATE,
  activo       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurrentes: acceso propio"
  ON public.recurrentes FOR ALL
  USING  (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_recurrentes_usuario ON public.recurrentes (usuario_id);
