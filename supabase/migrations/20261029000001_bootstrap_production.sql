-- ============================================================================
-- SCRIPT DE BOOTSTRAP OPERACIONAL E PRODUÇÃO (SUPABASE)
-- HelpTech Informática • Service Desk & Field Service
-- ============================================================================

-- 1. Extensões PostgreSQL Necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- 2. Confirmação Imediata de E-mails Administrativos Registrados no Supabase Auth
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW()),
    updated_at = NOW()
WHERE email IN (
    'suporte@helptech.com.br',
    'helptechinfoinformatica@gmail.com',
    'tecnico@helptech.com.br'
);

-- 3. Coordenações Regionais de Ensino (15 CREs do DF)
CREATE TABLE IF NOT EXISTS public.regional_coordinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Unidades Escolares
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cre_id UUID NOT NULL REFERENCES public.regional_coordinations(id) ON DELETE RESTRICT,
    inep VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    cep VARCHAR(10),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Técnicos Credenciados
CREATE TABLE IF NOT EXISTS public.technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) UNIQUE,
    primary_cre_id UUID REFERENCES public.regional_coordinations(id),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    radius_km INT DEFAULT 30,
    max_active_tickets INT DEFAULT 4,
    status VARCHAR(30) DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'ocupado', 'indisponivel', 'suspenso')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Usuários Administrativos & Controladoria (RBAC)
CREATE TABLE IF NOT EXISTS public.system_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('admin', 'controladoria', 'auditor_helptech')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Categorias de Serviço & SLA
CREATE TABLE IF NOT EXISTS public.ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    sla_response_hours INT DEFAULT 4,
    sla_resolution_hours INT DEFAULT 48,
    active BOOLEAN DEFAULT TRUE
);

-- 8. Tabela Principal de Chamados
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol VARCHAR(30) UNIQUE NOT NULL,
    tracking_token VARCHAR(64) UNIQUE NOT NULL,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES public.ticket_categories(id) ON DELETE RESTRICT,
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
    assigned_technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
    scheduled_visit_date TIMESTAMPTZ,
    arrival_time TIMESTAMPTZ,
    technical_report TEXT,
    closure_notes TEXT,
    school_representative_doc VARCHAR(100),
    school_signature_svg TEXT,
    cancelled_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabela de Orçamentos de Peças e Serviços
CREATE TABLE IF NOT EXISTS public.ticket_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES public.technicians(id),
    status VARCHAR(30) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'reprovado')),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    parts_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    labor_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    justification TEXT NOT NULL,
    parts_list JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Trilha Central de Auditoria de Eventos
CREATE TABLE IF NOT EXISTS public.ticket_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    actor_id UUID,
    actor_type VARCHAR(50) NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Índices Geográficos e Operacionais
CREATE INDEX IF NOT EXISTS idx_schools_geo ON public.schools USING gist (ll_to_earth(latitude, longitude));
CREATE INDEX IF NOT EXISTS idx_technicians_geo ON public.technicians USING gist (ll_to_earth(latitude, longitude));
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_protocol ON public.tickets(protocol);
CREATE INDEX IF NOT EXISTS idx_tickets_token ON public.tickets(tracking_token);

-- 12. Função de Despacho Geodésico
CREATE OR REPLACE FUNCTION public.get_best_candidate_technician(
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
    FROM public.technicians t
    LEFT JOIN public.tickets tk ON tk.assigned_technician_id = t.id 
        AND tk.status IN (
            'despachado',
            'visita_agendada',
            'em_deslocamento',
            'em_atendimento',
            'aguardando_orcamento',
            'aguardando_peca',
            'aguardando_terceiro'
        )
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

-- 13. Carga Inicial de Dados (CREs, Categorias, Administradores, Técnicos)
INSERT INTO public.regional_coordinations (code, name) VALUES
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

INSERT INTO public.ticket_categories (name, sla_response_hours, sla_resolution_hours) VALUES
('Rede & Conectividade de Internet', 2, 24),
('Laboratório de Informática / Computadores', 4, 48),
('Projetores & Telas Interativas', 4, 48),
('Impressoras & Scanners Administrativos', 8, 72),
('Servidores & Roteadores Wi-Fi', 2, 12),
('Elétrica de TI / No-breaks & Nobreaks', 2, 24)
ON CONFLICT DO NOTHING;

-- Usuários Administradores Homologados
INSERT INTO public.system_users (name, email, phone, role, active) VALUES
('Suporte Central HelpTech', 'suporte@helptech.com.br', '(61) 99229-5814', 'admin', true),
('Administrador Geral HelpTech', 'helptechinfoinformatica@gmail.com', '(61) 99229-5814', 'admin', true),
('Controladoria HelpTech', 'controladoria@helptech.com.br', '(61) 99229-5814', 'controladoria', true)
ON CONFLICT (email) DO UPDATE SET active = true, role = EXCLUDED.role;

-- Técnicos de Campo Homologados
INSERT INTO public.technicians (name, phone, email, latitude, longitude, radius_km, max_active_tickets, status, active) VALUES
('Carlos Silva (Técnico Ceilândia)', '(61) 98888-1111', 'tecnico@helptech.com.br', -15.8200, -48.1070, 35, 4, 'disponivel', true),
('Marcos Souza (Técnico Brazlândia)', '(61) 98888-2222', 'tecnico.marcos@helptech.com.br', -15.6800, -48.2000, 35, 4, 'disponivel', true)
ON CONFLICT (email) DO NOTHING;

-- Conexão das Escolas Iniciais para Atendimento
INSERT INTO public.schools (id, cre_id, inep, name, address, cep, latitude, longitude, contact_phone, contact_email)
SELECT 
    '53000001-0000-0000-0000-000000000001'::uuid,
    id,
    '53001234',
    'Centro de Ensino Fundamental 01 de Brazlândia',
    'Setor Tradicional Q 12 AE, Brazlândia - DF',
    '72710-000',
    -15.6724,
    -48.1998,
    '(61) 3901-6540',
    'cef01.brazlandia@escola.df.gov.br'
FROM public.regional_coordinations 
WHERE code = 'CRE_BRAZLANDIA'
ON CONFLICT (inep) DO NOTHING;

INSERT INTO public.schools (id, cre_id, inep, name, address, cep, latitude, longitude, contact_phone, contact_email)
SELECT 
    '53000002-0000-0000-0000-000000000002'::uuid,
    id,
    '53005678',
    'Centro Educacional 07 de Ceilândia',
    'QNM 13 Conjunto B, Ceilândia Sul - DF',
    '72215-130',
    -15.8214,
    -48.1065,
    '(61) 3901-7890',
    'ced07.ceilandia@escola.df.gov.br'
FROM public.regional_coordinations 
WHERE code = 'CRE_CEILANDIA'
ON CONFLICT (inep) DO NOTHING;

-- 14. Habilitar RLS com Políticas Abertas para o Frontend Inicial
ALTER TABLE public.regional_coordinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_audit_events ENABLE ROW LEVEL SECURITY;

-- Políticas de Leitura e Escrita
DO $$
BEGIN
    DROP POLICY IF EXISTS "Acesso público de leitura às CREs" ON public.regional_coordinations;
    CREATE POLICY "Acesso público de leitura às CREs" ON public.regional_coordinations FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Acesso público de leitura às Escolas" ON public.schools;
    CREATE POLICY "Acesso público de leitura às Escolas" ON public.schools FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Acesso às Categorias" ON public.ticket_categories;
    CREATE POLICY "Acesso às Categorias" ON public.ticket_categories FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Acesso aos Técnicos" ON public.technicians;
    CREATE POLICY "Acesso aos Técnicos" ON public.technicians FOR ALL USING (true);

    DROP POLICY IF EXISTS "Acesso aos Usuários do Sistema" ON public.system_users;
    CREATE POLICY "Acesso aos Usuários do Sistema" ON public.system_users FOR ALL USING (true);

    DROP POLICY IF EXISTS "Acesso aos Chamados" ON public.tickets;
    CREATE POLICY "Acesso aos Chamados" ON public.tickets FOR ALL USING (true);

    DROP POLICY IF EXISTS "Acesso aos Orçamentos" ON public.ticket_quotes;
    CREATE POLICY "Acesso aos Orçamentos" ON public.ticket_quotes FOR ALL USING (true);

    DROP POLICY IF EXISTS "Acesso à Auditoria" ON public.ticket_audit_events;
    CREATE POLICY "Acesso à Auditoria" ON public.ticket_audit_events FOR ALL USING (true);
END $$;
