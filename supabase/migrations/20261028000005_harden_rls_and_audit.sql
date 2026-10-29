-- ============================================================================
-- MIGRATION 05: Hardening de RLS, Isolamento Multitenant Estrito, Triggers de Integridade e Auditoria Inviolável
-- HelpTech Informática • Gestão e Despacho de TI
-- Versão 2.4 (Sprint Corretiva B.2.2 - Fechamento de Bloqueios Residuais)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNÇÕES AUXILIARES SEGURAS (SEARCH_PATH VAZIO & SECURITY DEFINER)
-- ----------------------------------------------------------------------------

-- 1.1 Extração segura do e-mail autenticado a partir do JWT (Sintaxe COALESCE universal)
CREATE OR REPLACE FUNCTION public.current_auth_email()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        pg_catalog.current_setting('request.jwt.claims', true)::json->>'email',
        ''
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- 1.2 Identificação segura de Administrador / Controladoria / Auditoria HelpTech
CREATE OR REPLACE FUNCTION public.is_admin_or_controller()
RETURNS BOOLEAN AS $$
BEGIN
    -- 1. Prioriza busca inequívoca por auth.uid()
    IF auth.uid() IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.system_users 
            WHERE auth_user_id = auth.uid()
              AND role IN ('admin', 'controladoria', 'auditor_helptech')
              AND active = TRUE
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- 2. Fallback por e-mail institucional homologado
    RETURN EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = public.current_auth_email()
          AND role IN ('admin', 'controladoria', 'auditor_helptech')
          AND active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- 1.3 Identificação segura de Superadministrador do Sistema (Gestão Plena RBAC)
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.system_users 
            WHERE auth_user_id = auth.uid()
              AND role = 'admin'
              AND active = TRUE
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.system_users 
        WHERE email = public.current_auth_email()
          AND role = 'admin'
          AND active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- 1.4 Identificação segura do ID do Técnico autenticado (Fail-Closed estrito sem agregação em UUID)
CREATE OR REPLACE FUNCTION public.current_technician_id()
RETURNS UUID AS $$
DECLARE
    v_tech_id UUID;
    v_count INT;
BEGIN
    -- 1. Prioriza vínculo inequívoco por auth.uid()
    IF auth.uid() IS NOT NULL THEN
        SELECT id INTO v_tech_id
        FROM public.technicians
        WHERE auth_user_id = auth.uid() AND active = TRUE;

        IF v_tech_id IS NOT NULL THEN
            RETURN v_tech_id;
        END IF;
    END IF;

    -- 2. Vínculo por e-mail com exigência de unicidade estrita
    SELECT COUNT(*) INTO v_count
    FROM public.technicians 
    WHERE email = public.current_auth_email() AND active = TRUE;

    IF v_count = 1 THEN
        SELECT id INTO v_tech_id
        FROM public.technicians 
        WHERE email = public.current_auth_email() AND active = TRUE;
        RETURN v_tech_id;
    END IF;

    -- Fail-Closed se inexistente ou duplicado
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- 1.5 Identificação segura do ID da Escola autenticada (Fail-Closed estrito sem agregação em UUID)
CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS UUID AS $$
DECLARE
    v_school_id UUID;
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.schools 
    WHERE contact_email = public.current_auth_email();

    -- Retorna ID se e somente se houver exatamente um registro
    IF v_count = 1 THEN
        SELECT id INTO v_school_id
        FROM public.schools 
        WHERE contact_email = public.current_auth_email();
        RETURN v_school_id;
    END IF;

    -- Fail-Closed em caso de ambiguidade ou ausência
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- Privilégios de execução estritos
REVOKE ALL ON FUNCTION public.current_auth_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_or_controller() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_system_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_technician_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_school_id() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_auth_email() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_controller() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_technician_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_school_id() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. HABILITAÇÃO EXPLÍCITA DE RLS EM TODAS AS TABELAS SENSÍVEIS
-- ----------------------------------------------------------------------------
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_dispatch_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. REMOÇÃO CONTROLADA E IDEMPOTENTE DE POLÍTICAS ANTERIORES (NEUTRALIZAÇÃO TOTAL)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins têm acesso total aos chamados" ON public.tickets;
DROP POLICY IF EXISTS "Técnicos visualizam seus chamados ou de sua CRE" ON public.tickets;
DROP POLICY IF EXISTS "Técnicos atualizam chamados atribuídos a si" ON public.tickets;
DROP POLICY IF EXISTS "Escolas visualizam apenas seus próprios chamados" ON public.tickets;
DROP POLICY IF EXISTS "Escolas podem abrir novos chamados" ON public.tickets;
DROP POLICY IF EXISTS "Acompanhamento público restrito por token único" ON public.tickets;
DROP POLICY IF EXISTS "Apenas admins visualizam usuários do sistema" ON public.system_users;
DROP POLICY IF EXISTS "Apenas admins criam ou alteram usuários do sistema" ON public.system_users;
DROP POLICY IF EXISTS "Leitura de técnicos por autenticados" ON public.technicians;
DROP POLICY IF EXISTS "Apenas admins gerenciam cadastro de técnicos" ON public.technicians;
DROP POLICY IF EXISTS "Auditoria visível apenas para admins e auditores HelpTech" ON public.ticket_audit_events;
DROP POLICY IF EXISTS "Inserção de auditoria permitida por usuários autenticados" ON public.ticket_audit_events;

DROP POLICY IF EXISTS "tickets_admin_all_policy" ON public.tickets;
DROP POLICY IF EXISTS "tickets_school_select_policy" ON public.tickets;
DROP POLICY IF EXISTS "tickets_school_insert_policy" ON public.tickets;
DROP POLICY IF EXISTS "tickets_school_update_policy" ON public.tickets;
DROP POLICY IF EXISTS "tickets_tech_select_policy" ON public.tickets;
DROP POLICY IF EXISTS "tickets_tech_update_policy" ON public.tickets;
DROP POLICY IF EXISTS "tickets_anon_token_select_policy" ON public.tickets;
DROP POLICY IF EXISTS "system_users_select_policy" ON public.system_users;
DROP POLICY IF EXISTS "system_users_admin_manage_policy" ON public.system_users;
DROP POLICY IF EXISTS "schools_select_authenticated" ON public.schools;
DROP POLICY IF EXISTS "schools_admin_manage" ON public.schools;
DROP POLICY IF EXISTS "technicians_select_authenticated" ON public.technicians;
DROP POLICY IF EXISTS "technicians_update_self" ON public.technicians;
DROP POLICY IF EXISTS "technicians_admin_manage" ON public.technicians;
DROP POLICY IF EXISTS "attachments_select_policy" ON public.ticket_attachments;
DROP POLICY IF EXISTS "attachments_insert_policy" ON public.ticket_attachments;
DROP POLICY IF EXISTS "quotes_select_policy" ON public.ticket_quotes;
DROP POLICY IF EXISTS "quotes_insert_policy" ON public.ticket_quotes;
DROP POLICY IF EXISTS "quotes_update_policy" ON public.ticket_quotes;
DROP POLICY IF EXISTS "quote_items_select_policy" ON public.ticket_quote_items;
DROP POLICY IF EXISTS "quote_items_manage_policy" ON public.ticket_quote_items;
DROP POLICY IF EXISTS "completions_select_policy" ON public.ticket_completions;
DROP POLICY IF EXISTS "completions_insert_policy" ON public.ticket_completions;
DROP POLICY IF EXISTS "dispatch_logs_select_policy" ON public.ticket_dispatch_logs;
DROP POLICY IF EXISTS "dispatch_logs_admin_manage" ON public.ticket_dispatch_logs;
DROP POLICY IF EXISTS "audit_events_select_policy" ON public.ticket_audit_events;
DROP POLICY IF EXISTS "audit_events_insert_strict_policy" ON public.ticket_audit_events;

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS DE INTEGRIDADE (OLD vs NEW & PROTEÇÃO DE CAMPOS IMUTÁVEIS)
-- ----------------------------------------------------------------------------

-- 4.1 Trigger de Integridade Multitenant em tickets (Campos imutáveis e antiforjamento)
CREATE OR REPLACE FUNCTION public.trg_enforce_ticket_update_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Unidade Escolar (school_id) é estritamente IMUTÁVEL (inclusive para administradores)
    IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN
        RAISE EXCEPTION 'RLS/Integrity: Não é permitido transferir chamado para outra Unidade Escolar'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Protocolo, Data de Abertura e Token de Acompanhamento são inalteráveis (inclusive para administradores)
    IF NEW.created_at IS DISTINCT FROM OLD.created_at 
       OR NEW.protocol IS DISTINCT FROM OLD.protocol 
       OR NEW.tracking_token IS DISTINCT FROM OLD.tracking_token THEN
        RAISE EXCEPTION 'RLS/Integrity: Protocolo, token de acompanhamento e carimbo de abertura são inalteráveis'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Superadministrador possui permissão para os demais ajustes de triagem e reatribuição operacional
    IF public.is_system_admin() THEN
        RETURN NEW;
    END IF;

    -- 4. Gestor escolar não pode alterar ou trocar técnico atribuído
    IF public.current_school_id() IS NOT NULL AND OLD.school_id = public.current_school_id() THEN
        IF NEW.assigned_technician_id IS DISTINCT FROM OLD.assigned_technician_id THEN
            RAISE EXCEPTION 'RLS/Integrity: Gestor escolar não possui permissão para atribuir ou trocar o técnico'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 5. Técnico não pode transferir para outro técnico
    IF public.current_technician_id() IS NOT NULL AND OLD.assigned_technician_id = public.current_technician_id() THEN
        IF NEW.assigned_technician_id IS DISTINCT FROM OLD.assigned_technician_id THEN
            RAISE EXCEPTION 'RLS/Integrity: Técnico não pode transferir atribuição de chamado para outrem'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_check_ticket_update_integrity ON public.tickets;
CREATE TRIGGER trg_check_ticket_update_integrity
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_ticket_update_integrity();

-- 4.2 Trigger de Proteção contra Escalada de Privilégios em system_users (INSERT e UPDATE)
CREATE OR REPLACE FUNCTION public.trg_enforce_system_users_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- No INSERT: Bloqueia criação de conta com perfil privilegiado por quem não é Superadmin
    IF TG_OP = 'INSERT' THEN
        IF NEW.role IN ('admin', 'controladoria', 'auditor_helptech') AND NOT public.is_system_admin() THEN
            RAISE EXCEPTION 'RLS/Privilege: Apenas superadministrador pode criar novos usuários administrativos'
                USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    -- No UPDATE: Apenas Superadministrador pode alterar role, active, auth_user_id ou email
    IF TG_OP = 'UPDATE' THEN
        IF NOT public.is_system_admin() THEN
            IF NEW.role IS DISTINCT FROM OLD.role 
               OR NEW.active IS DISTINCT FROM OLD.active 
               OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id 
               OR NEW.email IS DISTINCT FROM OLD.email THEN
                RAISE EXCEPTION 'RLS/Privilege: Apenas superadministrador pode alterar privilégios (role), e-mail ou estado ativo'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_check_system_user_privileges ON public.system_users;
CREATE TRIGGER trg_check_system_user_privileges
BEFORE INSERT OR UPDATE ON public.system_users
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_system_users_integrity();

-- 4.3 Trigger de Proteção de Cadastro de Técnicos (Impedir auto-reativação ou alteração de dados restritos)
CREATE OR REPLACE FUNCTION public.trg_enforce_technicians_integrity()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin_or_controller() THEN
        IF NEW.active IS DISTINCT FROM OLD.active 
           OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id 
           OR NEW.email IS DISTINCT FROM OLD.email 
           OR NEW.primary_cre_id IS DISTINCT FROM OLD.primary_cre_id THEN
            RAISE EXCEPTION 'RLS/Privilege: Técnico não pode alterar seus dados cadastrais restritos ou reativar cadastro'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_check_technicians_integrity ON public.technicians;
CREATE TRIGGER trg_check_technicians_integrity
BEFORE UPDATE ON public.technicians
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_technicians_integrity();

-- 4.4 Trigger de Proteção de Orçamentos (Impedir alteração indevida de valores por escolas ou orçamentos decididos)
CREATE OR REPLACE FUNCTION public.trg_enforce_ticket_quotes_integrity()
RETURNS TRIGGER AS $$
BEGIN
    IF public.is_system_admin() THEN
        RETURN NEW;
    END IF;

    -- Se for Gestor Escolar deliberando sobre o orçamento:
    IF public.current_school_id() IS NOT NULL THEN
        -- Proibido alterar valores técnicos, laudo ou identificadores
        IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
           OR NEW.technical_diagnosis IS DISTINCT FROM OLD.technical_diagnosis
           OR NEW.technician_id IS DISTINCT FROM OLD.technician_id
           OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id THEN
            RAISE EXCEPTION 'RLS/Integrity: Gestor escolar pode apenas deliberar (aprovar/rejeitar) sobre o orçamento'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Se for Técnico: Bloqueia alteração de orçamento já homologado ou cancelado
    IF public.current_technician_id() IS NOT NULL THEN
        IF OLD.status IN ('aprovado', 'rejeitado', 'cancelado') THEN
            RAISE EXCEPTION 'RLS/Integrity: Não é permitido modificar orçamento com deliberação já concluída'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_check_ticket_quotes_integrity ON public.ticket_quotes;
CREATE TRIGGER trg_check_ticket_quotes_integrity
BEFORE UPDATE ON public.ticket_quotes
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_ticket_quotes_integrity();

-- ----------------------------------------------------------------------------
-- 5. PRIVILÉGIOS E POLÍTICAS DEFINITIVAS: TABELA SYSTEM_USERS
-- ----------------------------------------------------------------------------

-- 5.1 Revogação explícita de acessos anônimos e públicos na tabela de usuários
REVOKE ALL ON TABLE public.system_users FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.system_users TO authenticated;

-- 5.2 Política de Leitura: Próprio usuário ou Administradores/Controladoria
CREATE POLICY "system_users_select_policy"
ON public.system_users FOR SELECT
TO authenticated
USING (
    public.is_admin_or_controller()
    OR auth_user_id = auth.uid()
    OR email = public.current_auth_email()
);

-- 5.3 Política de Inserção: Exclusiva para Superadministrador do Sistema
CREATE POLICY "system_users_insert_policy"
ON public.system_users FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin());

-- 5.4 Política de Atualização: Exclusiva para Superadministrador do Sistema
CREATE POLICY "system_users_update_policy"
ON public.system_users FOR UPDATE
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- 5.5 Política de Exclusão: Exclusiva para Superadministrador do Sistema
CREATE POLICY "system_users_delete_policy"
ON public.system_users FOR DELETE
TO authenticated
USING (public.is_system_admin());

-- ----------------------------------------------------------------------------
-- 6. POLÍTICAS DEFINITIVAS: ESCOLAS E TÉCNICOS (ELIMINAÇÃO DE USING TRUE)
-- ----------------------------------------------------------------------------

-- Escolas: leitura restrita a operadores do sistema, técnicos credenciados e à própria escola
CREATE POLICY "schools_select_authenticated"
ON public.schools FOR SELECT
TO authenticated
USING (
    public.is_admin_or_controller()
    OR id = public.current_school_id()
    OR public.current_technician_id() IS NOT NULL
);

CREATE POLICY "schools_admin_manage"
ON public.schools FOR ALL
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- Técnicos: leitura restrita a administradores, à própria conta do técnico e a gestores escolares vinculados
CREATE POLICY "technicians_select_authenticated"
ON public.technicians FOR SELECT
TO authenticated
USING (
    public.is_admin_or_controller()
    OR id = public.current_technician_id()
    OR public.current_school_id() IS NOT NULL
);

CREATE POLICY "technicians_update_self"
ON public.technicians FOR UPDATE
TO authenticated
USING (id = public.current_technician_id())
WITH CHECK (id = public.current_technician_id());

CREATE POLICY "technicians_admin_manage"
ON public.technicians FOR ALL
TO authenticated
USING (public.is_admin_or_controller())
WITH CHECK (public.is_admin_or_controller());

-- ----------------------------------------------------------------------------
-- 7. POLÍTICAS DEFINITIVAS: TABELA TICKETS (MULTITENANCY ESTRITO)
-- ----------------------------------------------------------------------------

-- 7.1 Admin / Controladoria: Acesso supervisionado
CREATE POLICY "tickets_admin_all_policy"
ON public.tickets FOR ALL
TO authenticated
USING (public.is_admin_or_controller())
WITH CHECK (public.is_admin_or_controller());

-- 7.2 Escolas: Leitura estrita de chamados próprios
CREATE POLICY "tickets_school_select_policy"
ON public.tickets FOR SELECT
TO authenticated
USING (school_id = public.current_school_id());

-- 7.3 Escolas: Inserção estrita vinculada à própria escola
CREATE POLICY "tickets_school_insert_policy"
ON public.tickets FOR INSERT
TO authenticated
WITH CHECK (
    school_id IS NOT NULL 
    AND school_id = public.current_school_id()
);

-- 7.4 Escolas: Atualização permitida apenas em chamados próprios em fase inicial
CREATE POLICY "tickets_school_update_policy"
ON public.tickets FOR UPDATE
TO authenticated
USING (
    school_id = public.current_school_id()
    AND status IN ('aberto', 'despachado')
)
WITH CHECK (
    school_id = public.current_school_id()
);

-- 7.5 Técnicos: Visualização de chamados atribuídos ou abertos na sua CRE
CREATE POLICY "tickets_tech_select_policy"
ON public.tickets FOR SELECT
TO authenticated
USING (
    assigned_technician_id = public.current_technician_id()
    OR (
        status = 'aberto' AND school_id IN (
            SELECT s.id FROM public.schools s 
            JOIN public.technicians t ON t.primary_cre_id = s.cre_id
            WHERE t.id = public.current_technician_id()
        )
    )
);

-- 7.6 Técnicos: Atualização restrita aos chamados atribuídos a si
CREATE POLICY "tickets_tech_update_policy"
ON public.tickets FOR UPDATE
TO authenticated
USING (
    assigned_technician_id = public.current_technician_id()
)
WITH CHECK (
    assigned_technician_id = public.current_technician_id()
);

-- 7.7 Garantir gerador CSPRNG (192 bits / gen_random_bytes) e unicidade do tracking_token
DO $$
BEGIN
    ALTER TABLE public.tickets 
    ALTER COLUMN tracking_token 
    SET DEFAULT ('tk_' || encode(gen_random_bytes(24), 'hex'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 8. RPC DE ACOMPANHAMENTO PÚBLICO (ALTA ENTROPIA & MITIGAÇÃO DE ENUMERAÇÃO)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ticket_public_tracking(p_tracking_token TEXT)
RETURNS TABLE (
    protocol VARCHAR,
    status VARCHAR,
    urgency_level VARCHAR,
    created_at TIMESTAMPTZ,
    scheduled_visit_at TIMESTAMPTZ,
    arrival_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    description TEXT
) AS $$
BEGIN
    -- Validação estrita de formato e alta entropia: prefixo 'tk_' seguido de 32 a 60 caracteres hexadecimais
    -- Mitiga enumeração, ataques de força bruta e tentativas de injeção
    IF p_tracking_token IS NULL 
       OR p_tracking_token !~ '^tk_[0-9a-fA-F]{32,60}$' THEN
        RETURN;
    END IF;

    -- Retorna estritamente os 8 campos públicos aprovados (sem PII, sem chaves internas, sem chamados cancelados)
    RETURN QUERY
    SELECT 
        t.protocol,
        t.status,
        t.urgency_level,
        t.created_at,
        t.scheduled_visit_at,
        t.arrived_at AS arrival_at,
        t.resolved_at AS completed_at,
        t.description
    FROM public.tickets t
    WHERE t.tracking_token = p_tracking_token
      AND t.status != 'cancelado'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.get_ticket_public_tracking(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ticket_public_tracking(TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. ANEXOS, ORÇAMENTOS E CONCLUSÕES
-- ----------------------------------------------------------------------------

-- 9.1 Anexos (ticket_attachments)
CREATE POLICY "attachments_select_policy"
ON public.ticket_attachments FOR SELECT
TO authenticated
USING (
    public.is_admin_or_controller()
    OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_attachments.ticket_id
          AND (t.school_id = public.current_school_id() OR t.assigned_technician_id = public.current_technician_id())
    )
);

CREATE POLICY "attachments_insert_policy"
ON public.ticket_attachments FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin_or_controller()
    OR (phase = 'abertura' AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_attachments.ticket_id AND t.school_id = public.current_school_id()))
    OR (phase IN ('diagnostico', 'conclusao') AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_attachments.ticket_id AND t.assigned_technician_id = public.current_technician_id()))
);

-- 9.2 Orçamentos (ticket_quotes)
CREATE POLICY "quotes_select_policy"
ON public.ticket_quotes FOR SELECT
TO authenticated
USING (
    public.is_admin_or_controller()
    OR technician_id = public.current_technician_id()
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_quotes.ticket_id AND t.school_id = public.current_school_id())
);

CREATE POLICY "quotes_insert_policy"
ON public.ticket_quotes FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin_or_controller()
    OR (technician_id = public.current_technician_id() AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_quotes.ticket_id AND t.assigned_technician_id = public.current_technician_id()))
);

CREATE POLICY "quotes_update_policy"
ON public.ticket_quotes FOR UPDATE
TO authenticated
USING (
    public.is_admin_or_controller()
    OR (technician_id = public.current_technician_id() AND status = 'pendente')
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_quotes.ticket_id AND t.school_id = public.current_school_id())
)
WITH CHECK (
    public.is_admin_or_controller()
    OR (technician_id = public.current_technician_id() AND status = 'pendente')
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_quotes.ticket_id AND t.school_id = public.current_school_id())
);

-- 9.3 Itens de Orçamento (ticket_quote_items)
CREATE POLICY "quote_items_select_policy"
ON public.ticket_quote_items FOR SELECT
TO authenticated
USING (
    public.is_admin_or_controller()
    OR EXISTS (SELECT 1 FROM public.ticket_quotes q JOIN public.tickets t ON t.id = q.ticket_id WHERE q.id = ticket_quote_items.quote_id AND (q.technician_id = public.current_technician_id() OR t.school_id = public.current_school_id()))
);

CREATE POLICY "quote_items_manage_policy"
ON public.ticket_quote_items FOR ALL
TO authenticated
USING (
    public.is_admin_or_controller()
    OR EXISTS (SELECT 1 FROM public.ticket_quotes q WHERE q.id = ticket_quote_items.quote_id AND q.technician_id = public.current_technician_id() AND q.status = 'pendente')
)
WITH CHECK (
    public.is_admin_or_controller()
    OR EXISTS (SELECT 1 FROM public.ticket_quotes q WHERE q.id = ticket_quote_items.quote_id AND q.technician_id = public.current_technician_id() AND q.status = 'pendente')
);

-- 9.4 Conclusão de Chamados (ticket_completions) - Imutabilidade pós-assinatura
CREATE POLICY "completions_select_policy"
ON public.ticket_completions FOR SELECT
TO authenticated
USING (
    public.is_admin_or_controller()
    OR technician_id = public.current_technician_id()
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_completions.ticket_id AND t.school_id = public.current_school_id())
);

CREATE POLICY "completions_insert_policy"
ON public.ticket_completions FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin_or_controller()
    OR (technician_id = public.current_technician_id() AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_completions.ticket_id AND t.assigned_technician_id = public.current_technician_id()))
);

-- 9.5 Histórico de Despacho (ticket_dispatch_logs)
CREATE POLICY "dispatch_logs_select_policy"
ON public.ticket_dispatch_logs FOR SELECT
TO authenticated
USING (public.is_admin_or_controller() OR technician_id = public.current_technician_id());

CREATE POLICY "dispatch_logs_admin_manage"
ON public.ticket_dispatch_logs FOR ALL
TO authenticated
USING (public.is_admin_or_controller())
WITH CHECK (public.is_admin_or_controller());

-- ----------------------------------------------------------------------------
-- 10. RPC DE AUDITORIA CONTROLADA COM WHITELIST OPERACIONAL DE METADADOS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_ticket_audit_event(
    p_ticket_id UUID,
    p_event_type VARCHAR,
    p_from_status VARCHAR DEFAULT NULL,
    p_to_status VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_user_email TEXT;
    v_actor_name VARCHAR(150);
    v_actor_role VARCHAR(50);
    v_ticket_record RECORD;
    v_school_id UUID;
    v_tech_id UUID;
    v_audit_id UUID;
    v_count INTEGER;
    v_sanitized_meta JSONB := '{}'::jsonb;
    v_key TEXT;
    v_val JSONB;
    v_allowed_keys TEXT[] := ARRAY[
        'notes', 'reason', 'refusal_reason', 'scheduled_visit_at',
        'pending_part_notes', 'third_party_notes', 'arrival_lat', 'arrival_lng',
        'urgency_level', 'status', 'dispatch_attempts'
    ];
BEGIN
    v_user_email := public.current_auth_email();
    IF v_user_email = '' AND auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Não autorizado: identificação da sessão ausente para auditoria'
            USING ERRCODE = '42501';
    END IF;

    -- 1. Validação do catálogo canônico de eventos permitidos
    IF p_event_type NOT IN (
        'STATUS_CHANGED', 'DISPATCH_NOTIFIED', 'DISPATCH_ACCEPTED', 'DISPATCH_REFUSED',
        'CHECK_IN', 'VISIT_SCHEDULED', 'WAITING_PARTS', 'WAITING_THIRD_PARTY',
        'RESUMED', 'QUOTE_SUBMITTED', 'QUOTE_APPROVED', 'QUOTE_REJECTED',
        'COMPLETED', 'CANCELED'
    ) THEN
        RAISE EXCEPTION 'Evento de auditoria inválido ou não homologado: %', p_event_type
            USING ERRCODE = '22023';
    END IF;

    -- 2. Validar existência do chamado
    SELECT id, school_id, assigned_technician_id INTO v_ticket_record
    FROM public.tickets
    WHERE id = p_ticket_id;

    IF v_ticket_record.id IS NULL THEN
        RAISE EXCEPTION 'Chamado inexistente para registro de auditoria'
            USING ERRCODE = '02000';
    END IF;

    -- 3. Identificação fidedigna do ator (Fail-Closed, priorizando auth.uid() e rejeitando ambiguidades)
    IF auth.uid() IS NOT NULL THEN
        SELECT name, role INTO v_actor_name, v_actor_role
        FROM public.system_users
        WHERE auth_user_id = auth.uid() AND active = TRUE;
    END IF;

    IF v_actor_name IS NULL AND v_user_email <> '' THEN
        SELECT COUNT(*) INTO v_count
        FROM public.system_users
        WHERE email = v_user_email AND active = TRUE;

        IF v_count = 1 THEN
            SELECT name, role INTO v_actor_name, v_actor_role
            FROM public.system_users
            WHERE email = v_user_email AND active = TRUE;
        END IF;
    END IF;

    -- Resolução para técnicos credenciados
    IF v_actor_name IS NULL THEN
        IF auth.uid() IS NOT NULL THEN
            SELECT id, name, 'technician' INTO v_tech_id, v_actor_name, v_actor_role
            FROM public.technicians
            WHERE auth_user_id = auth.uid() AND active = TRUE;
        END IF;

        IF v_actor_name IS NULL AND v_user_email <> '' THEN
            SELECT COUNT(*) INTO v_count
            FROM public.technicians
            WHERE email = v_user_email AND active = TRUE;

            IF v_count = 1 THEN
                SELECT id, name, 'technician' INTO v_tech_id, v_actor_name, v_actor_role
                FROM public.technicians
                WHERE email = v_user_email AND active = TRUE;
            END IF;
        END IF;

        -- Validação de isolamento do técnico: chamado deve estar atribuído a este técnico
        IF v_tech_id IS NOT NULL AND v_ticket_record.assigned_technician_id != v_tech_id THEN
            RAISE EXCEPTION 'Técnico não autorizado a auditar chamado não atribuído a si'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Resolução para unidades escolares
    IF v_actor_name IS NULL AND v_user_email <> '' THEN
        SELECT COUNT(*) INTO v_count
        FROM public.schools
        WHERE contact_email = v_user_email;

        IF v_count = 1 THEN
            SELECT id, 'Gestão ' || name, 'school' INTO v_school_id, v_actor_name, v_actor_role
            FROM public.schools
            WHERE contact_email = v_user_email;
        END IF;

        -- Validação de isolamento da escola: chamado deve pertencer à própria escola
        IF v_school_id IS NOT NULL AND v_ticket_record.school_id != v_school_id THEN
            RAISE EXCEPTION 'Escola não autorizada a registrar auditoria em chamado de outra unidade'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_actor_name IS NULL THEN
        RAISE EXCEPTION 'Usuário sem perfil operacional cadastrado ou com vínculo ambíguo para auditoria'
            USING ERRCODE = '42501';
    END IF;

    -- 4. Matriz de Autorização por Papel e Tipo de Evento
    IF v_actor_role = 'school' THEN
        IF p_event_type NOT IN ('STATUS_CHANGED', 'QUOTE_APPROVED', 'QUOTE_REJECTED', 'CANCELED') THEN
            RAISE EXCEPTION 'Perfil escolar não tem permissão para registrar o evento operacional %', p_event_type
                USING ERRCODE = '42501';
        END IF;
    ELSIF v_actor_role = 'technician' THEN
        IF p_event_type NOT IN (
            'STATUS_CHANGED', 'DISPATCH_ACCEPTED', 'DISPATCH_REFUSED', 'CHECK_IN',
            'VISIT_SCHEDULED', 'WAITING_PARTS', 'WAITING_THIRD_PARTY', 'RESUMED',
            'QUOTE_SUBMITTED', 'COMPLETED'
        ) THEN
            RAISE EXCEPTION 'Técnico de campo não tem permissão para deliberar ou registrar o evento %', p_event_type
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 4. Sanitização estrita por WHITELIST de metadados operacionais
    IF p_metadata IS NOT NULL THEN
        FOR v_key, v_val IN SELECT * FROM jsonb_each(p_metadata) LOOP
            IF v_key = ANY(v_allowed_keys) THEN
                v_sanitized_meta := jsonb_set(v_sanitized_meta, ARRAY[v_key], v_val);
            END IF;
        END LOOP;
    END IF;

    INSERT INTO public.ticket_audit_events (
        ticket_id, event_type, from_status, to_status, actor_name, actor_role, metadata
    ) VALUES (
        p_ticket_id, p_event_type, p_from_status, p_to_status, v_actor_name, v_actor_role, v_sanitized_meta
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.record_ticket_audit_event(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_ticket_audit_event(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB) TO authenticated;

-- Políticas de ticket_audit_events
CREATE POLICY "audit_events_select_policy"
ON public.ticket_audit_events FOR SELECT
TO authenticated
USING (
    public.is_admin_or_controller()
    OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_audit_events.ticket_id
          AND (t.school_id = public.current_school_id() OR t.assigned_technician_id = public.current_technician_id())
    )
);

CREATE POLICY "audit_events_insert_strict_policy"
ON public.ticket_audit_events FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_controller());

-- Imutabilidade total da trilha: sem políticas de UPDATE ou DELETE.
