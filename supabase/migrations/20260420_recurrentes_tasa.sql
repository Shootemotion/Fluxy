-- Add monthly interest rate to recurrentes
ALTER TABLE recurrentes ADD COLUMN IF NOT EXISTS tasa_interes DECIMAL(6,4) DEFAULT 0;
