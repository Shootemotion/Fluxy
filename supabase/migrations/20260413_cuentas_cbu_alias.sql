-- Migration: agregar CBU y alias a cuentas
-- Ejecutar en Supabase Studio → SQL Editor

ALTER TABLE cuentas
  ADD COLUMN IF NOT EXISTS cbu   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS alias TEXT DEFAULT NULL;

-- Índice opcional para buscar por CBU
CREATE INDEX IF NOT EXISTS idx_cuentas_cbu ON cuentas (cbu) WHERE cbu IS NOT NULL;
