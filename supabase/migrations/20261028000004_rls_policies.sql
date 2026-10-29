-- ============================================================================
-- MIGRATION 04: Políticas de Segurança em Nível de Linha (Row Level Security - RLS)
-- HelpTech Informática • Gestão e Despacho de TI
-- ============================================================================

-- 1. FUNÇÕES HELPER DE AUTENTICAÇÃO E PERFIL
CREATE OR REPLACE FUNCTION current_auth_email()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::json->>'email',
        ''
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_controller()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM system_users 
        WHERE (auth_user_id = auth.uid() OR email = current_auth_email())
          AND role IN ('admin', 'controladoria', 'auditor_helptech')
          AND active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_technician_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM technicians 
        WHERE (auth_user_id = auth.uid() OR email = current_auth_email())
          AND active = TRUE
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. HABILITAR RLS NAS TABELAS EXPICITAMENTE
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_audit_events ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS PARA A TABELA TICKETS
-- 3.1 Administradores e Controladoria têm acesso total
CREATE POLICY "Admins têm acesso total aos chamados"
ON tickets FOR ALL
TO authenticated
USING (is_admin_or_controller())
WITH CHECK (is_admin_or_controller());

-- 3.2 Técnicos podem visualizar chamados atribuídos ou disponíveis na sua CRE
CREATE POLICY "Técnicos visualizam seus chamados ou de sua CRE"
ON tickets FOR SELECT
TO authenticated
USING (
    assigned_technician_id = current_technician_id()
    OR (
        status = 'aberto' AND school_id IN (
            SELECT s.id FROM schools s 
            JOIN technicians t ON t.primary_cre_id = s.cre_id
            WHERE t.id = current_technician_id()
        )
    )
);

-- 3.3 Técnicos podem atualizar apenas chamados atribuídos a si próprios
CREATE POLICY "Técnicos atualizam chamados atribuídos a si"
ON tickets FOR UPDATE
TO authenticated
USING (assigned_technician_id = current_technician_id())
WITH CHECK (assigned_technician_id = current_technician_id());

-- 3.4 Escolas podem visualizar apenas os chamados de sua própria unidade
CREATE POLICY "Escolas visualizam apenas seus próprios chamados"
ON tickets FOR SELECT
TO authenticated
USING (
    school_id IN (
        SELECT id FROM schools WHERE contact_email = current_auth_email()
    )
);

-- 3.5 Escolas podem criar chamados para sua unidade
CREATE POLICY "Escolas podem abrir novos chamados"
ON tickets FOR INSERT
TO authenticated
WITH CHECK (
    school_id IN (
        SELECT id FROM schools WHERE contact_email = current_auth_email()
    )
);

-- 3.6 Acesso público restrito via Token de Acompanhamento (Tracking Token)
CREATE POLICY "Acompanhamento público restrito por token único"
ON tickets FOR SELECT
TO anon
USING (
    tracking_token = current_setting('request.headers', true)::json->>'x-tracking-token'
);

-- 4. POLÍTICAS PARA A TABELA SYSTEM_USERS
CREATE POLICY "Apenas admins visualizam usuários do sistema"
ON system_users FOR SELECT
TO authenticated
USING (is_admin_or_controller());

CREATE POLICY "Apenas admins criam ou alteram usuários do sistema"
ON system_users FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM system_users 
        WHERE (auth_user_id = auth.uid() OR email = current_auth_email())
          AND role = 'admin'
          AND active = TRUE
    )
);

-- 5. POLÍTICAS PARA A TABELA TECHNICIANS
CREATE POLICY "Leitura de técnicos por autenticados"
ON technicians FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "Apenas admins gerenciam cadastro de técnicos"
ON technicians FOR ALL
TO authenticated
USING (is_admin_or_controller());

-- 6. POLÍTICAS PARA TRILHA DE AUDITORIA (IMUTABILIDADE)
CREATE POLICY "Auditoria visível apenas para admins e auditores HelpTech"
ON ticket_audit_events FOR SELECT
TO authenticated
USING (is_admin_or_controller());

CREATE POLICY "Inserção de auditoria permitida por usuários autenticados"
ON ticket_audit_events FOR INSERT
TO authenticated
WITH CHECK (TRUE);

-- Nenhuma política de UPDATE ou DELETE é criada para ticket_audit_events para garantir imutabilidade estrita.

