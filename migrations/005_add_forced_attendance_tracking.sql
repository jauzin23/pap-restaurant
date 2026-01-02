-- Migration: Add forced attendance tracking
-- Allows managers to manually force clock-in/out and track who did it

ALTER TABLE presencas 
ADD COLUMN forcado_por_gestor BOOLEAN DEFAULT FALSE,
ADD COLUMN gestor_id UUID REFERENCES users(id),
ADD COLUMN motivo_forca TEXT;

-- Add index for querying forced entries
CREATE INDEX idx_presencas_forcado ON presencas(forcado_por_gestor) WHERE forcado_por_gestor = TRUE;

-- Add index for manager lookups
CREATE INDEX idx_presencas_gestor_id ON presencas(gestor_id) WHERE gestor_id IS NOT NULL;
