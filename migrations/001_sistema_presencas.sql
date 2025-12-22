-- ================================================================
-- Sistema de Presenças (Clock In/Out System)
-- Migration: 001_sistema_presencas
-- Created: 2025-12-13
-- ================================================================

-- ================================================================
-- 0. Ativar Extensões Necessárias
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. Adicionar coluna NFC aos utilizadores
-- ================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS nfc_card_uid VARCHAR(50) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_nfc_card ON users(nfc_card_uid);

COMMENT ON COLUMN users.nfc_card_uid IS 'UID do cartão NFC do utilizador para registo de ponto';

-- ================================================================
-- 2. Tabela de Dispositivos (ESP32 Clock Devices)
-- ================================================================
DROP TABLE IF EXISTS logs_dispositivos CASCADE;
DROP TABLE IF EXISTS codigos_vinculacao CASCADE;
DROP TABLE IF EXISTS presencas CASCADE;
DROP TABLE IF EXISTS dispositivos_ponto CASCADE;

CREATE TABLE dispositivos_ponto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(100) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    localizacao VARCHAR(255),
    ip_address INET,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    firmware_version VARCHAR(50),
    is_online BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dispositivos_online ON dispositivos_ponto(is_online);
CREATE INDEX idx_dispositivos_device_id ON dispositivos_ponto(device_id);

COMMENT ON TABLE dispositivos_ponto IS 'Dispositivos ESP32 para registo de ponto';
COMMENT ON COLUMN dispositivos_ponto.device_id IS 'Identificador único do dispositivo ESP32';
COMMENT ON COLUMN dispositivos_ponto.nome IS 'Nome amigável do dispositivo (ex: "Entrada Principal")';
COMMENT ON COLUMN dispositivos_ponto.localizacao IS 'Localização física do dispositivo';
COMMENT ON COLUMN dispositivos_ponto.is_online IS 'Status de conexão em tempo real';

-- ================================================================
-- 3. Tabela de Presenças (Attendance Records)
-- ================================================================
CREATE TABLE presencas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nfc_card_uid VARCHAR(50) NOT NULL,
    tipo_acao VARCHAR(10) NOT NULL CHECK (tipo_acao IN ('entrada', 'saida')),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(100) REFERENCES dispositivos_ponto(device_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes para performance
CREATE INDEX idx_presencas_user_id ON presencas(user_id);
CREATE INDEX idx_presencas_timestamp ON presencas(timestamp);
CREATE INDEX idx_presencas_card_uid ON presencas(nfc_card_uid);
CREATE INDEX idx_presencas_user_timestamp ON presencas(user_id, timestamp);
CREATE INDEX idx_presencas_device_id ON presencas(device_id);

COMMENT ON TABLE presencas IS 'Registo de entradas e saídas dos funcionários';
COMMENT ON COLUMN presencas.tipo_acao IS 'Tipo de ação: entrada ou saida';
COMMENT ON COLUMN presencas.device_id IS 'Dispositivo que registou a presença';

-- ================================================================
-- 4. Tabela de Códigos de Vinculação (Enrollment Codes)
-- ================================================================
CREATE TABLE codigos_vinculacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(100) REFERENCES dispositivos_ponto(device_id) ON DELETE CASCADE,
    criado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    usado BOOLEAN DEFAULT false,
    usado_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_codigos_vinculacao_codigo ON codigos_vinculacao(codigo);
CREATE INDEX idx_codigos_vinculacao_user_id ON codigos_vinculacao(user_id);
CREATE INDEX idx_codigos_vinculacao_expires ON codigos_vinculacao(expires_at);
CREATE INDEX idx_codigos_vinculacao_usado ON codigos_vinculacao(usado);

COMMENT ON TABLE codigos_vinculacao IS 'Códigos temporários para vincular cartões NFC a utilizadores';
COMMENT ON COLUMN codigos_vinculacao.codigo IS 'Código único gerado para a vinculação';
COMMENT ON COLUMN codigos_vinculacao.expires_at IS 'Código expira após 5 minutos';
COMMENT ON COLUMN codigos_vinculacao.usado IS 'Indica se o código já foi utilizado';

-- ================================================================
-- 5. Tabela de Logs dos Dispositivos (Device Logs)
-- ================================================================
CREATE TABLE logs_dispositivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(100) NOT NULL REFERENCES dispositivos_ponto(device_id) ON DELETE CASCADE,
    tipo_log VARCHAR(50) NOT NULL,
    mensagem TEXT NOT NULL,
    nivel VARCHAR(20) DEFAULT 'info' CHECK (nivel IN ('debug', 'info', 'warning', 'error')),
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes para performance e busca
CREATE INDEX idx_logs_device_id ON logs_dispositivos(device_id);
CREATE INDEX idx_logs_timestamp ON logs_dispositivos(timestamp);
CREATE INDEX idx_logs_nivel ON logs_dispositivos(nivel);
CREATE INDEX idx_logs_tipo ON logs_dispositivos(tipo_log);
CREATE INDEX idx_logs_device_timestamp ON logs_dispositivos(device_id, timestamp DESC);

COMMENT ON TABLE logs_dispositivos IS 'Logs dos dispositivos ESP32 (auto-eliminados após 24h)';
COMMENT ON COLUMN logs_dispositivos.tipo_log IS 'Tipo de log: connection, nfc_scan, error, heartbeat, etc.';
COMMENT ON COLUMN logs_dispositivos.nivel IS 'Nível de severidade do log';
COMMENT ON COLUMN logs_dispositivos.metadata IS 'Dados adicionais em formato JSON';

-- ================================================================
-- 6. Função para Auto-Limpar Logs Antigos (24h)
-- ================================================================
CREATE OR REPLACE FUNCTION limpar_logs_antigos()
RETURNS void AS $$
BEGIN
    DELETE FROM logs_dispositivos 
    WHERE timestamp < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION limpar_logs_antigos IS 'Remove logs com mais de 24 horas';

-- ================================================================
-- 7. Trigger para Atualizar updated_at nos Dispositivos
-- ================================================================
CREATE OR REPLACE FUNCTION atualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dispositivos_updated_at
    BEFORE UPDATE ON dispositivos_ponto
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_updated_at();

-- ================================================================
-- 8. Scheduled Job para Limpar Logs (PostgreSQL Extension pg_cron)
-- ================================================================
-- Nota: Requer extensão pg_cron instalada
-- Para instalar: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 
-- Descomente as linhas abaixo se pg_cron estiver disponível:
-- 
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 
-- SELECT cron.schedule(
--     'limpar-logs-dispositivos',
--     '0 * * * *',  -- A cada hora
--     'SELECT limpar_logs_antigos();'
-- );

-- ================================================================
-- 9. View para Presenças de Hoje
-- ================================================================
CREATE OR REPLACE VIEW presencas_hoje AS
SELECT 
    u.id as user_id,
    u.name,
    u.username,
    u.profile_image,
    MIN(CASE WHEN p.tipo_acao = 'entrada' THEN p.timestamp END) as primeira_entrada,
    MAX(CASE WHEN p.tipo_acao = 'saida' THEN p.timestamp END) as ultima_saida,
    CASE 
        WHEN MAX(CASE WHEN p.tipo_acao = 'saida' THEN p.timestamp END) IS NULL THEN 'trabalhando'
        ELSE 'concluido'
    END as status,
    CASE 
        WHEN MAX(CASE WHEN p.tipo_acao = 'saida' THEN p.timestamp END) IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (MAX(CASE WHEN p.tipo_acao = 'saida' THEN p.timestamp END) - 
                                MIN(CASE WHEN p.tipo_acao = 'entrada' THEN p.timestamp END))) / 3600
        WHEN MIN(CASE WHEN p.tipo_acao = 'entrada' THEN p.timestamp END) IS NOT NULL THEN
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - 
                                MIN(CASE WHEN p.tipo_acao = 'entrada' THEN p.timestamp END))) / 3600
        ELSE 0
    END as horas_trabalhadas,
    COUNT(p.id) as total_registos
FROM users u
LEFT JOIN presencas p ON u.id = p.user_id AND DATE(p.timestamp) = CURRENT_DATE
WHERE p.id IS NOT NULL OR u.labels @> ARRAY['staff']
GROUP BY u.id, u.name, u.username, u.profile_image;

COMMENT ON VIEW presencas_hoje IS 'Vista das presenças do dia atual para todos os funcionários';

-- ================================================================
-- 10. View para Estatísticas de Dispositivos
-- ================================================================
CREATE OR REPLACE VIEW estatisticas_dispositivos AS
SELECT 
    d.device_id,
    d.nome,
    d.localizacao,
    d.is_online,
    d.last_seen,
    COUNT(DISTINCT p.user_id) as total_utilizadores_hoje,
    COUNT(p.id) as total_registos_hoje,
    (SELECT COUNT(*) FROM logs_dispositivos l 
     WHERE l.device_id = d.device_id 
     AND l.timestamp > NOW() - INTERVAL '1 hour') as logs_ultima_hora,
    (SELECT COUNT(*) FROM logs_dispositivos l 
     WHERE l.device_id = d.device_id 
     AND l.nivel = 'error' 
     AND l.timestamp > NOW() - INTERVAL '24 hours') as erros_24h
FROM dispositivos_ponto d
LEFT JOIN presencas p ON d.device_id = p.device_id AND DATE(p.timestamp) = CURRENT_DATE
GROUP BY d.device_id, d.nome, d.localizacao, d.is_online, d.last_seen;

COMMENT ON VIEW estatisticas_dispositivos IS 'Estatísticas em tempo real dos dispositivos';

-- ================================================================
-- 11. Inserir Dados de Exemplo (Opcional - Comentado)
-- ================================================================
-- Descomentar para inserir dispositivo de teste:
-- 
-- INSERT INTO dispositivos_ponto (device_id, nome, localizacao, firmware_version)
-- VALUES 
--     ('ESP32-001', 'Entrada Principal', 'Receção', '1.0.0'),
--     ('ESP32-002', 'Cozinha', 'Cozinha Principal', '1.0.0');

-- ================================================================
-- Fim da Migration
-- ================================================================
