-- ============================================================================
-- PLATAFORMA DE SERVICE DESK & FIELD SERVICE - ESCOLAS PÚBLICAS DF
-- Master DDL & Engine Schema (PostgreSQL 16 / Supabase)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- 1. COORDENAÇÕES REGIONAIS DE ENSINO (15 CRES DO DISTRITO FEDERAL)
CREATE TABLE IF NOT EXISTS regional_coordinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE UNIDADES ESCOLARES (REDE OFICIAL SEEDF)
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cre_id UUID NOT NULL REFERENCES regional_coordinations(id) ON DELETE RESTRICT,
    inep VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schools_cre ON schools(cre_id);
CREATE INDEX IF NOT EXISTS idx_schools_inep ON schools(inep);
CREATE INDEX IF NOT EXISTS idx_schools_geo ON schools USING gist (ll_to_earth(latitude, longitude));

-- 3. TABELA DE TÉCNICOS CREDENCIADOS
CREATE TABLE IF NOT EXISTS technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) UNIQUE,
    primary_cre_id UUID REFERENCES regional_coordinations(id),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    radius_km INT DEFAULT 30,
    max_active_tickets INT DEFAULT 4,
    status VARCHAR(30) DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'ocupado', 'indisponivel', 'suspenso')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technicians_geo ON technicians USING gist (ll_to_earth(latitude, longitude));

-- 4. TABELA DE CATEGORIAS DE SERVIÇO & MATRIZ DE SLA
CREATE TABLE IF NOT EXISTS ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    sla_response_hours INT DEFAULT 4,
    sla_resolution_hours INT DEFAULT 48,
    active BOOLEAN DEFAULT TRUE
);

-- 5. TABELA PRINCIPAL DE CHAMADOS (TICKETS / ORDENS DE SERVIÇO)
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol VARCHAR(30) UNIQUE NOT NULL,
    tracking_token VARCHAR(64) UNIQUE NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES ticket_categories(id) ON DELETE RESTRICT,
    requester_name VARCHAR(150) NOT NULL,
    requester_role VARCHAR(100) NOT NULL,
    requester_phone VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    equipment_patrimony VARCHAR(100),
    urgency_level VARCHAR(20) DEFAULT 'media' CHECK (urgency_level IN ('baixa', 'media', 'alta', 'critica')),
    status VARCHAR(30) DEFAULT 'aberto' CHECK (status IN (
        'aberto',
        'despachado',
        'em_deslocamento',
        'em_atendimento',
        'aguardando_orcamento',
        'aguardando_peca',
        'concluido',
        'cancelado'
    )),
    assigned_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
    dispatch_attempts INT DEFAULT 0,
    dispatch_timeout_at TIMESTAMPTZ,
    arrival_lat FLOAT,
    arrival_lng FLOAT,
    arrived_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_school ON tickets(school_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tech ON tickets(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_token ON tickets(tracking_token);

-- 6. HISTÓRICO DE DESPACHO E TIMEOUTS (20 MIN)
CREATE TABLE IF NOT EXISTS ticket_dispatch_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL CHECK (status IN ('notificado', 'aceito', 'recusado', 'timeout')),
    refusal_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ANEXOS E FOTOS DE EVIDÊNCIAS (WEBP CLIENT-SIDE COMPRESSED)
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    phase VARCHAR(20) NOT NULL CHECK (phase IN ('abertura', 'diagnostico', 'conclusao')),
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size_bytes INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ORÇAMENTOS DE PEÇAS E SERVIÇOS ESPECIAIS
CREATE TABLE IF NOT EXISTS ticket_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE RESTRICT,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    technical_diagnosis TEXT NOT NULL,
    pdf_url TEXT,
    status VARCHAR(30) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'cancelado')),
    decision_by_name VARCHAR(150),
    decision_reason TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES ticket_quotes(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('peca', 'servico')),
    item_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- 9. CONCLUSÃO E ASSINATURA DIGITAL DO GESTOR ESCOLAR
CREATE TABLE IF NOT EXISTS ticket_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID UNIQUE NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES technicians(id),
    service_summary TEXT NOT NULL,
    school_representative_name VARCHAR(150) NOT NULL,
    school_representative_doc VARCHAR(50) NOT NULL,
    signature_svg TEXT NOT NULL,
    pdf_os_url TEXT,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. MOTOR DE DESPACHO INTELIGENTE (PROXIMIDADE GEOGRÁFICA & CARGA ATIVA)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_best_candidate_technician(
    p_school_lat FLOAT, 
    p_school_lng FLOAT,
    p_excluded_techs UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE (
    technician_id UUID,
    name VARCHAR,
    phone VARCHAR,
    distance_km FLOAT,
    active_load BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.phone,
        ROUND((point(t.longitude, t.latitude) <@> point(p_school_lng, p_school_lat)) * 1.609344, 2) AS distance_km,
        COUNT(tk.id) AS active_load
    FROM technicians t
    LEFT JOIN tickets tk ON tk.assigned_technician_id = t.id 
        AND tk.status IN ('despachado', 'em_deslocamento', 'em_atendimento', 'aguardando_peca')
    WHERE t.status = 'disponivel' 
      AND t.active = TRUE
      AND (p_excluded_techs IS NULL OR t.id != ALL(p_excluded_techs))
    GROUP BY t.id, t.name, t.phone, t.longitude, t.latitude, t.max_active_tickets, t.radius_km
    HAVING COUNT(tk.id) < t.max_active_tickets
       AND ROUND((point(t.longitude, t.latitude) <@> point(p_school_lng, p_school_lat)) * 1.609344, 2) <= t.radius_km
    ORDER BY distance_km ASC, active_load ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. SEED DATA MATRIX (15 CRES OFICIAIS + ESCOLAS + CATEGORIAS + TÉCNICOS)
-- ============================================================================
INSERT INTO regional_coordinations (code, name) VALUES
('CRE_BRAZLANDIA', 'Brazlândia'),
('CRE_CEILANDIA', 'Ceilândia'),
('CRE_GAMA', 'Gama'),
('CRE_GUARA', 'Guará'),
('CRE_NUCLEO_BANDEIRANTE', 'Núcleo Bandeirante'),
('CRE_PARANOA', 'Paranoá'),
('CRE_PARANOA_ITAPOA', 'Paranoá/Itapoã'),
('CRE_PLANALTINA', 'Planaltina'),
('CRE_PLANO_PILOTO', 'Plano Piloto'),
('CRE_RECANTO_DAS_EMAS', 'Recanto das Emas'),
('CRE_SAMAMBAIA', 'Samambaia'),
('CRE_SANTA_MARIA', 'Santa Maria'),
('CRE_SAO_SEBASTIAO', 'São Sebastião'),
('CRE_SOBRADINHO', 'Sobradinho'),
('CRE_TAGUATINGA', 'Taguatinga')
ON CONFLICT (code) DO NOTHING;

INSERT INTO ticket_categories (name, sla_response_hours, sla_resolution_hours) VALUES
('Rede & Conectividade de Internet', 2, 24),
('Laboratório de Informática / Computadores', 4, 48),
('Projetores & Telas Interativas', 4, 48),
('Impressoras & Scanners Administrativos', 8, 72),
('Servidores & Roteadores Wi-Fi', 2, 12),
('Elétrica de TI / No-breaks & Nobreaks', 2, 24)
ON CONFLICT DO NOTHING;
