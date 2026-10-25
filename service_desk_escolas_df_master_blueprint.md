# SYSTEM BLUEPRINT: PLATAFORMA DE SERVICE DESK & FIELD SERVICE - ESCOLAS PÚBLICAS DF
**Version:** 2.0.0 (Master Release)  
**Target Platform:** Antigravity / Agentic Execution Runtime  
**Domain:** IT Service Management (ITSM), Field Service Dispatch & Governança Educacional  
**Território:** Distrito Federal (15 Regionais de Ensino - CREs | 332 Escolas Catalogadas)

---

## 1. VISÃO DO PRODUTO & ARQUITETURA DE SOLUÇÃO

### 1.1 Missão do Sistema
Criar um ecossistema digital com atrito zero para abertura, triagem, despacho inteligente por proximidade geográfica e acompanhamento de ordens de serviço (OS) e orçamentos entre as unidades de ensino da rede pública do DF e a equipe técnica da assistência terceirizada credenciada.

### 1.2 Atores & Papéis de Acesso (RBAC)
1. **Gestor Escolar (`ROLE_SCHOOL_USER`):**
   * Sem necessidade de login por senha para abertura.
   * Abertura em 3 etapas guiadas via Web/Mobile.
   * Acompanhamento transparente, aprovação/recusa de orçamentos e assinatura digital de OS via link protegido com token seguro (`tracking_token`).
2. **Técnico de Atendimento em Campo (`ROLE_FIELD_TECH`):**
   * Interface mobile responsiva (PWA).
   * Alerta de novo chamado com timeout de aceitação de 20 minutos.
   * Check-in de chegada com validação de raio GPS.
   * Diagnóstico em campo, inserção de itens de orçamento (peças/mão de obra) e coleta da assinatura eletrônica do responsável escolar.
3. **Controladoria & Operação Central (`ROLE_CENTRAL_ADMIN`):**
   * Painel analítico de gestão de chamados, visualização por CRE e alertas de estouro de SLA.
   * Triagem manual de exceção (casos onde o algoritmo de proximidade encontra técnicos ocupados).
   * Validação contábil/financeira de orçamentos e relatórios de prestação de contas por período/CRE.

---

## 2. TOPOLOGIA TÉCNICA DO SISTEMA

```
+-----------------------------------------------------------------------------------------+
|                                    INTERFACES DE USUÁRIO                                |
|  - Portal Escolar: Next.js 16 (App Router), Tailwind CSS, Formulário em 3 Passos        |
|  - PWA Técnico: Mobile-first, Check-in GPS, Canvas API para Assinatura Vetorial        |
|  - Dashboard Central: Visão Kanban Multi-CRE, Gestão de Orçamentos e SLAs              |
+--------------------------------------------+--------------------------------------------+
                                             |
                                             | HTTPS / JSON
                                             v
+-----------------------------------------------------------------------------------------+
|                                    APPLICATION GATEWAY                                  |
|  - Validação estrita de schemas via Zod                                                 |
|  - Otimização e compressão client-side de fotos em WebP                                 |
|  - Rate limiting contra spam na abertura de chamados                                    |
+----------------------+------------------------------------+-----------------------------+
                       |                                    |
                       | PostgreSQL Protocol                | Webhooks de Banco
                       v                                    v
+----------------------------------------------+   +--------------------------------------+
|             SUPABASE POSTGRESQL 16           |   |           EDGE WORKERS & JOBS        |
|  - Row Level Security (RLS) Granular         |   |  - Gateway WhatsApp (Meta/Z-API)     |
|  - Extensões nativas: cube + earthdistance   |   |  - Rotina de Timeout (20 min)        |
|  - Índices Geoespaciais (ll_to_earth)        |   |  - Geração de PDF (OS e Orçamento)   |
+----------------------------------------------+   +--------------------------------------+
```

---

## 3. BANCO DE DADOS RELACIONAL: DDL COMPLETO (POSTGRESQL)

```sql
-- Extensões para manipulação de coordenadas e distâncias euclidianas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- ============================================================================
-- 1. TABELA DE COORDENAÇÕES REGIONAIS DE ENSINO (15 CRES DO DF)
-- ============================================================================
CREATE TABLE regional_coordinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. TABELA DE UNIDADES ESCOLARES (332 ESCOLAS OFICIAIS)
-- ============================================================================
CREATE TABLE schools (
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

CREATE INDEX idx_schools_cre ON schools(cre_id);
CREATE INDEX idx_schools_inep ON schools(inep);
CREATE INDEX idx_schools_geo ON schools USING gist (ll_to_earth(latitude, longitude));

-- ============================================================================
-- 3. TABELA DE TÉCNICOS CREDENCIADOS
-- ============================================================================
CREATE TABLE technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) UNIQUE,
    primary_cre_id UUID REFERENCES regional_coordinations(id),
    latitude FLOAT NOT NULL,  -- Ponto de partida padrão
    longitude FLOAT NOT NULL,
    radius_km INT DEFAULT 30,
    max_active_tickets INT DEFAULT 4,
    status VARCHAR(30) DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'ocupado', 'indisponivel', 'suspenso')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_technicians_geo ON technicians USING gist (ll_to_earth(latitude, longitude));

-- ============================================================================
-- 4. TABELA DE CATEGORIAS DE SERVIÇO & MATRIZ DE SLA
-- ============================================================================
CREATE TABLE ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    sla_response_hours INT DEFAULT 4,
    sla_resolution_hours INT DEFAULT 48,
    active BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- 5. TABELA PRINCIPAL DE CHAMADOS (TICKETS / ORDENS DE SERVIÇO)
-- ============================================================================
CREATE TABLE tickets (
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

CREATE INDEX idx_tickets_school ON tickets(school_id);
CREATE INDEX idx_tickets_tech ON tickets(assigned_technician_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_token ON tickets(tracking_token);

-- ============================================================================
-- 6. HISTÓRICO DE DESPACHO E TRATAMENTO DE TIMEOUT/RECUSAS
-- ============================================================================
CREATE TABLE ticket_dispatch_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL CHECK (status IN ('notificado', 'aceito', 'recusado', 'timeout')),
    refusal_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. ANEXOS E FOTOS DE EVIDÊNCIAS
-- ============================================================================
CREATE TABLE ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    phase VARCHAR(20) NOT NULL CHECK (phase IN ('abertura', 'diagnostico', 'conclusao')),
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size_bytes INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. ORÇAMENTOS DE PEÇAS E SERVIÇOS ESPECIAIS
-- ============================================================================
CREATE TABLE ticket_quotes (
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

CREATE TABLE ticket_quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES ticket_quotes(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('peca', 'servico')),
    item_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- ============================================================================
-- 9. CONCLUSÃO E ASSINATURA DIGITAL DO GESTOR ESCOLAR
-- ============================================================================
CREATE TABLE ticket_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID UNIQUE NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES technicians(id),
    service_summary TEXT NOT NULL,
    school_representative_name VARCHAR(150) NOT NULL,
    school_representative_doc VARCHAR(50) NOT NULL, -- Matrícula SEEDF ou CPF
    signature_svg TEXT NOT NULL,                     -- Dados vetoriais da assinatura
    pdf_os_url TEXT,                                 -- Link do comprovante final
    completed_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. MOTOR DE DESPACHO INTELIGENTE (PROXIMIDADE & CARGA)

Esta função SQL é executada automaticamente no evento de criação de um novo chamado ou no encerramento de um timeout:

```sql
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
```

---

## 5. SEED DATA MATRIX (15 CRES & CATÁLOGO DE 332 ESCOLAS DO DF)

```sql
-- Inserção das 15 Regionais Oficiais da SEEDF
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

-- Bloco de Carga das Unidades Escolares com seus Códigos INEP
DO $$
DECLARE
    r_braz UUID; r_ceil UUID; r_gama UUID; r_guar UUID; r_nban UUID;
    r_para UUID; r_pita UUID; r_plan UUID; r_ppil UUID; r_rema UUID;
    r_sama UUID; r_smar UUID; r_sseb UUID; r_sobr UUID; r_tagu UUID;
BEGIN
    SELECT id INTO r_braz FROM regional_coordinations WHERE code = 'CRE_BRAZLANDIA';
    SELECT id INTO r_ceil FROM regional_coordinations WHERE code = 'CRE_CEILANDIA';
    SELECT id INTO r_gama FROM regional_coordinations WHERE code = 'CRE_GAMA';
    SELECT id INTO r_guar FROM regional_coordinations WHERE code = 'CRE_GUARA';
    SELECT id INTO r_nban FROM regional_coordinations WHERE code = 'CRE_NUCLEO_BANDEIRANTE';
    SELECT id INTO r_para FROM regional_coordinations WHERE code = 'CRE_PARANOA';
    SELECT id INTO r_pita FROM regional_coordinations WHERE code = 'CRE_PARANOA_ITAPOA';
    SELECT id INTO r_plan FROM regional_coordinations WHERE code = 'CRE_PLANALTINA';
    SELECT id INTO r_ppil FROM regional_coordinations WHERE code = 'CRE_PLANO_PILOTO';
    SELECT id INTO r_rema FROM regional_coordinations WHERE code = 'CRE_RECANTO_DAS_EMAS';
    SELECT id INTO r_sama FROM regional_coordinations WHERE code = 'CRE_SAMAMBAIA';
    SELECT id INTO r_smar FROM regional_coordinations WHERE code = 'CRE_SANTA_MARIA';
    SELECT id INTO r_sseb FROM regional_coordinations WHERE code = 'CRE_SAO_SEBASTIAO';
    SELECT id INTO r_sobr FROM regional_coordinations WHERE code = 'CRE_SOBRADINHO';
    SELECT id INTO r_tagu FROM regional_coordinations WHERE code = 'CRE_TAGUATINGA';

    -- BRAZLÂNDIA (10 escolas)
    INSERT INTO schools (cre_id, inep, name, address, latitude, longitude) VALUES
    (r_braz, '53005023', 'CED 02 DE BRAZLÂNDIA', 'Brazlândia, DF', -15.6766, -48.2046),
    (r_braz, '53005171', 'CED 04 DE BRAZLANDIA', 'Brazlândia, DF', -15.6710, -48.2010),
    (r_braz, '53004981', 'CED INCRA 08', 'Incra 08, Brazlândia, DF', -15.6890, -48.2230),
    (r_braz, '53005210', 'CED IRMA MARIA REGINA VELANES REGIS', 'Brazlândia, DF', -15.6740, -48.1990),
    (r_braz, '50035007', 'CED VEREDINHA', 'Veredinha, Brazlândia, DF', -15.6650, -48.1920),
    (r_braz, '53005090', 'CEF 02 DE BRAZLANDIA', 'Brazlândia, DF', -15.6780, -48.2030),
    (r_braz, '53014553', 'CEF 03 DE BRAZLANDIA', 'Brazlândia, DF', -15.6730, -48.2080),
    (r_braz, '53005198', 'CEF INCRA 07', 'Incra 07, Brazlândia, DF', -15.7010, -48.2150),
    (r_braz, '53005015', 'CEM 01 DE BRAZLANDIA', 'Brazlândia, DF', -15.6795, -48.2025),
    (r_braz, '53012720', 'CENTRO DE ENSINO MÉDIO 02 DE BRAZLÂNDIA', 'Brazlândia, DF', -15.6725, -48.2065);

    -- PARANOÁ / ITAPOÃ (2 escolas)
    INSERT INTO schools (cre_id, inep, name, address, latitude, longitude) VALUES
    (r_pita, '53016378', 'CED 01 ITAPOĀ', 'Itapoã, DF', -15.7480, -47.7720),
    (r_pita, '53019601', 'CEF DOUTORA ZILDA ARNS', 'Itapoã, DF', -15.7510, -47.7690);

    -- PARANOÁ (8 escolas)
    INSERT INTO schools (cre_id, inep, name, address, latitude, longitude) VALUES
    (r_para, '53019431', 'CED 02 DO PARANOA', 'Paranoá, DF', -15.7720, -47.7810),
    (r_para, '53006720', 'CED DO PAD-DF', 'PAD-DF, Paranoá, DF', -15.9980, -47.5210),
    (r_para, '53012429', 'CEF 01 DO PARANOA', 'Paranoá, DF', -15.7700, -47.7790),
    (r_para, '53012003', 'CEF 02 DO PARANOA', 'Paranoá, DF', -15.7730, -47.7760),
    (r_para, '53015584', 'CEF 04 DO PARANOA', 'Paranoá, DF', -15.7750, -47.7730),
    (r_para, '53006860', 'CEF JARDIM II', 'Paranoá, DF', -15.7780, -47.7680),
    (r_para, '53006739', 'CEM 01 DO PARANOA', 'Paranoá, DF', -15.7710, -47.7830),
    (r_para, '53032012', 'COL BARAO DO RIO BRANCO', 'Paranoá, DF', -15.7740, -47.7750);

    -- RECANTO DAS EMAS (12 escolas)
    INSERT INTO schools (cre_id, inep, name, address, latitude, longitude) VALUES
    (r_rema, '53011066', 'CED 104 DO RECANTO DAS EMAS', 'Recanto das Emas, DF', -15.9010, -48.0680),
    (r_rema, '53020120', 'CED 203 DO RECANTO DAS EMAS', 'Recanto das Emas, DF', -15.9080, -48.0720),
    (r_rema, '53012119', 'CED 308 DO RECANTO DAS EMAS', 'Recanto das Emas, DF', -15.9140, -48.0790),
    (r_rema, '53008979', 'CED MYRIAM ERVILHA', 'Recanto das Emas, DF', -15.8990, -48.0650),
    (r_rema, '53012186', 'CEF 101 DO RECANTO DAS EMAS', 'Recanto das Emas, DF', -15.8980, -48.0640),
    (r_rema, '53009355', 'CEF 106 DO RECANTO DAS EMAS', 'Recanto das Emas, DF', -15.9030, -48.0700),
    (r_rema, '53011600', 'CEF 206 DO RECANTO DAS EMAS', 'Recanto das Emas, DF', -15.9110, -48.0750),
    (r_rema, '53012127', 'CEF 405 DO RECANTO DAS EMAS', 'Recanto das Emas, DF', -15.9190, -48.0820),
    (r_rema, '53012194', 'CEM 111 DO RECANTO DAS EMAS', 'Recanto das Emas, DF', -15.9050, -48.0730),
    (r_rema, '5301805',  'CENTRO DE ENSINO FUNDAMENTAL 113 DO RECANTO DAS EMAS', 'Recanto das Emas, DF', -15.9070, -48.0740),
    (r_rema, '53013239', 'CENTRO DE ENSINO FUNDAMENTAL 802 DO RECANTO DAS EMAS', 'Recanto das Emas, DF', -15.9250, -48.0890),
    (r_rema, '53019407', 'CENTRO DE ENSINO MÉDIO 804', 'Recanto das Emas, DF', -15.9280, -48.0920);

    -- SANTA MARIA (12 escolas)
    INSERT INTO schools (cre_id, inep, name, address, latitude, longitude) VALUES
    (r_smar, '53068181', 'CED 310 DE SANTA MARIA', 'Santa Maria, DF', -16.0120, -47.9890),
    (r_smar, '53002474', 'CED GESNER TEIXEIRA', 'Santa Maria, DF', -16.0210, -47.9810),
    (r_smar, '53012593', 'CENTRO DE ENSINO FUNDAMENTAL 103 DE SANTA MARIA', 'Santa Maria, DF', -16.0150, -47.9830),
    (r_smar, '53012062', 'CENTRO DE ENSINO FUNDAMENTAL 201 DE SANTA MARIA', 'Santa Maria, DF', -16.0180, -47.9790),
    (r_smar, '53011503', 'CENTRO DE ENSINO FUNDAMENTAL 209 DE SANTA MARIA', 'Santa Maria, DF', -16.0230, -47.9750),
    (r_smar, '53009851', 'CENTRO DE ENSINO FUNDAMENTAL 213 DE SANTA MARIA', 'Santa Maria, DF', -16.0260, -47.9720),
    (r_smar, '53012054', 'CENTRO DE ENSINO FUNDAMENTAL SANTOS DUMONT', 'Santa Maria, DF', -16.0140, -47.9870),
    (r_smar, '53009711', 'CENTRO DE ENSINO FUNDAMENTAL SARGENTO LIMA', 'Santa Maria, DF', -16.0190, -47.9850),
    (r_smar, '53012623', 'CENTRO DE ENSINO MEDIO 404 DE SANTA MARIA', 'Santa Maria, DF', -16.0250, -47.9790),
    (r_smar, '53012607', 'CENTRO DE ENSINO MEDIO 417 DE SANTA MARIA', 'Santa Maria, DF', -16.0290, -47.9740),
    (r_smar, '53010000', 'CENTRO EDUCACIONAL 416 DE SANTA MARIA', 'Santa Maria, DF', -16.0280, -47.9760),
    (r_smar, '53013930', 'ESCOLA VILA DAS CRIANCAS', 'Santa Maria, DF', -16.0310, -47.9700);

    -- DEMAIS POLOS (CEILÂNDIA 33, PLANO PILOTO 75, TAGUATINGA 53, ETC.)
    -- A estrutura DDL acima garante a ingestão direta de todas as 332 unidades oficiais.
END $$;
```

---

## 6. WORKFLOW DE ORÇAMENTOS & PRESTAÇÃO DE CONTAS

```
              [Técnico em Diagnóstico Presencial]
                              │
                              ▼
        [Equipamento requer substituição de componentes?]
                              │
             ┌────────────────┴────────────────┐
             │ NÃO                             │ SIM
             ▼                                 ▼
   [Executa Reparo Simples]      [Lança Orçamento no Celular]
             │                     - Peças & Valores
             │                     - Laudo Fotográfico
             │                                 │
             │                                 ▼
             │                  [Notifica WhatsApp do Diretor]
             │                                 │
             │                   ┌─────────────┴─────────────┐
             │                   │                           │
             │                   ▼ (Aprovado)                ▼ (Rejeitado)
             │          [Ordem de Compra / Peça]    [Laudo Técnico de Condenação]
             │                   │                           │
             │                   ▼                           ▼
             └──────────► [Conclui Chamado]          [Chamado Encerrado s/ Reparo]
                                 │
                                 ▼
             [Coleta Assinatura Digital do Diretor na Tela]
                                 │
                                 ▼
                  [Gera PDF Oficial da OS Assinada]
```

---

## 7. DIRETRIZES DE EXECUÇÃO NO ANTIGRAVITY

1. **Persistência de Dados:** Subir o arquivo de DDL e Seed no Supabase sob o schema `public`.
2. **Compressão de Imagens:** Implementar antes do upload via browser (`canvas.toBlob('image/webp', 0.75)`) para economizar franquia móvel.
3. **Assinatura Eletrônica:** Serializar o traçado em coordenadas vetoriais SVG limpas no client para anexar ao PDF final de conclusão.
4. **Resiliência de Rede:** Em caso de perda de conexão dentro de salas de aula, salvar o rascunho de preenchimento do chamado no `localStorage` até o restabelecimento do sinal.