-- ================================================================
-- Remove Logs System from Dispositivos
-- Migration: 006_remove_logs_dispositivos
-- Created: 2026-01-02
-- Description: Completely removes the device logs system from the
--              presencas (attendance) feature to simplify the system
-- ================================================================

-- ================================================================
-- 1. Drop the Auto-Cleanup Function (if it exists)
-- ================================================================
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS limpar_logs_antigos();
EXCEPTION 
    WHEN undefined_function THEN 
        NULL;
END $$;

-- ================================================================
-- 2. Drop Indexes (for clean removal)
-- ================================================================
DROP INDEX IF EXISTS idx_logs_device_id;
DROP INDEX IF EXISTS idx_logs_timestamp;
DROP INDEX IF EXISTS idx_logs_nivel;
DROP INDEX IF EXISTS idx_logs_tipo;
DROP INDEX IF EXISTS idx_logs_device_timestamp;

-- ================================================================
-- 3. Drop the Logs Table
-- ================================================================
DROP TABLE IF EXISTS logs_dispositivos CASCADE;

-- ================================================================
-- 4. Update estatisticas_dispositivos View
--    Remove log-related columns (logs_ultima_hora, erros_24h)
-- ================================================================
CREATE OR REPLACE VIEW estatisticas_dispositivos AS
SELECT 
    d.device_id,
    d.nome,
    d.localizacao,
    d.is_online,
    d.last_seen,
    d.firmware_version,
    d.ip_address,
    d.created_at,
    d.updated_at,
    COUNT(DISTINCT p.user_id) as total_utilizadores_hoje,
    COUNT(p.id) as total_registos_hoje
FROM dispositivos_ponto d
LEFT JOIN presencas p ON d.device_id = p.device_id AND DATE(p.timestamp) = CURRENT_DATE
GROUP BY d.device_id, d.nome, d.localizacao, d.is_online, d.last_seen, 
         d.firmware_version, d.ip_address, d.created_at, d.updated_at;

COMMENT ON VIEW estatisticas_dispositivos IS 'Estatísticas em tempo real dos dispositivos (logs system removed)';

-- ================================================================
-- 5. Verification Query (Optional - Run After Migration)
-- ================================================================
-- To verify the table is removed, run:
-- SELECT * FROM information_schema.tables WHERE table_name = 'logs_dispositivos';
-- Should return 0 rows

-- ================================================================
-- End of Migration
-- ================================================================
