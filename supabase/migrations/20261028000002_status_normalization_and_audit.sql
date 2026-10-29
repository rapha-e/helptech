-- ============================================================================
-- MIGRATION 02: Normalização de Status de Chamados, RBAC e Trilha de Auditoria
-- HelpTech Escolas DF (SEEDF)
-- ============================================================================

-- 5. TABELA DE USUÁRIOS ADMINISTRATIVOS & CONTROLADORIA (RBAC)
CREATE TABLE IF NOT EXISTS system_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'controladoria' CHECK (role IN ('admin', 'controladoria', 'auditor_seedf')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA PRINCIPAL DE CHAMADOS (10 STATUS OFICIAIS ALINHADOS AO FRONTEND)
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
        'visita_agendada',
        'em_deslocamento',
        'em_atendimento',
        'aguardando_orcamento',
        'aguardando_peca',
        'aguardando_terceiro',
        'concluido',
        'cancelado'
    )),
    assigned_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
    dispatch_attempts INT DEFAULT 0,
    dispatch_timeout_at TIMESTAMPTZ,
    scheduled_visit_at TIMESTAMPTZ,
    scheduled_visit_notes TEXT,
    pending_part_notes TEXT,
    third_party_notes TEXT,
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
CREATE INDEX IF NOT EXISTS idx_tickets_protocol ON tickets(protocol);

-- 7. HISTÓRICO DE DESPACHO E TIMEOUTS (20 MIN)
CREATE TABLE IF NOT EXISTS ticket_dispatch_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL CHECK (status IN ('notificado', 'aceito', 'recusado', 'timeout')),
    refusal_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ANEXOS E FOTOS DE EVIDÊNCIAS
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    phase VARCHAR(20) NOT NULL CHECK (phase IN ('abertura', 'diagnostico', 'conclusao')),
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_size_bytes INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ORÇAMENTOS DE PEÇAS E SERVIÇOS ESPECIAIS
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

-- 10. CONCLUSÃO E ASSINATURA DIGITAL DO GESTOR ESCOLAR
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

-- 11. TRILHA CENTRAL DE AUDITORIA DE EVENTOS DE NEGÓCIO (LGPD / GOVERNANÇA)
CREATE TABLE IF NOT EXISTS ticket_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30),
    actor_name VARCHAR(150) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_ticket ON ticket_audit_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON ticket_audit_events(created_at);

