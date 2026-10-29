-- ============================================================================
-- FASE 1 (WS2): MOTOR DE REGRAS DE NEGÓCIO E DESPACHO NO SERVIDOR (POSTGRESQL)
-- Stored Procedures (RPCs), FSM, Protocolos e Re-despacho Transacional
-- ============================================================================

-- 1. Sequence Anual de Protocolos de Atendimento
CREATE SEQUENCE IF NOT EXISTS public.ticket_protocol_seq START 1;

-- 2. Função de Geração de Protocolo Canônico (OS-YYYY-XXXXX)
CREATE OR REPLACE FUNCTION public.generate_ticket_protocol()
RETURNS VARCHAR(30) LANGUAGE plpgsql AS $$
DECLARE
    v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
    v_seq BIGINT := nextval('public.ticket_protocol_seq');
BEGIN
    RETURN 'OS-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;

-- 3. Função de Geração de Token Criptográfico (192 bits / CSPRNG)
CREATE OR REPLACE FUNCTION public.generate_tracking_token()
RETURNS VARCHAR(64) LANGUAGE plpgsql AS $$
BEGIN
    RETURN 'tk_' || encode(gen_random_bytes(24), 'hex');
END;
$$;

-- 4. Função da Máquina de Estados Finita (FSM) - Validador de Transições
CREATE OR REPLACE FUNCTION public.assert_valid_ticket_transition(p_from VARCHAR, p_to VARCHAR)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
    IF p_from = p_to THEN
        RETURN TRUE;
    END IF;

    -- Estados terminais nunca podem ser alterados ou reabertos
    IF p_from IN ('concluido', 'cancelado') THEN
        RAISE EXCEPTION 'Violação de Ciclo de Vida: Estado terminal "%" não permite novas transições.', p_from;
    END IF;

    -- Matriz canônica de transições homologadas
    IF p_from = 'aberto' AND p_to IN ('despachado', 'cancelado') THEN RETURN TRUE; END IF;
    IF p_from = 'despachado' AND p_to IN ('visita_agendada', 'em_deslocamento', 'em_atendimento', 'aberto', 'cancelado') THEN RETURN TRUE; END IF;
    IF p_from = 'visita_agendada' AND p_to IN ('em_deslocamento', 'em_atendimento', 'cancelado') THEN RETURN TRUE; END IF;
    IF p_from = 'em_deslocamento' AND p_to IN ('em_atendimento', 'cancelado') THEN RETURN TRUE; END IF;
    IF p_from = 'em_atendimento' AND p_to IN ('aguardando_orcamento', 'aguardando_peca', 'aguardando_terceiro', 'concluido', 'cancelado') THEN RETURN TRUE; END IF;
    IF p_from = 'aguardando_orcamento' AND p_to IN ('em_atendimento', 'aguardando_peca', 'concluido', 'cancelado') THEN RETURN TRUE; END IF;
    IF p_from = 'aguardando_peca' AND p_to IN ('em_atendimento', 'concluido', 'cancelado') THEN RETURN TRUE; END IF;
    IF p_from = 'aguardando_terceiro' AND p_to IN ('em_atendimento', 'concluido', 'cancelado') THEN RETURN TRUE; END IF;

    RAISE EXCEPTION 'Violação FSM: Transição de status ilegal de "%" para "%".', p_from, p_to;
END;
$$;

-- 5. RPC create_ticket (Abertura, Validação, Despacho e Auditoria em Transação Única)
CREATE OR REPLACE FUNCTION public.create_ticket(
    p_school_id UUID,
    p_category_id UUID,
    p_requester_name VARCHAR,
    p_requester_role VARCHAR,
    p_requester_phone VARCHAR,
    p_title VARCHAR,
    p_description VARCHAR,
    p_urgency_level VARCHAR DEFAULT 'media',
    p_equipment_patrimony VARCHAR DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_school RECORD;
    v_protocol VARCHAR(30);
    v_tracking_token VARCHAR(64);
    v_tech_id UUID := NULL;
    v_status VARCHAR(30) := 'aberto';
    v_ticket_id UUID;
BEGIN
    -- Validação da Unidade Escolar
    SELECT id, latitude, longitude, name INTO v_school 
    FROM public.schools 
    WHERE id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unidade escolar com ID % não encontrada no catálogo.', p_school_id;
    END IF;

    -- Geração segura de protocolo e token pelo servidor
    v_protocol := public.generate_ticket_protocol();
    v_tracking_token := public.generate_tracking_token();

    -- Cálculo de Despacho Geodésico no Servidor
    SELECT technician_id INTO v_tech_id
    FROM public.get_best_candidate_technician(v_school.latitude, v_school.longitude, ARRAY[]::UUID[])
    LIMIT 1;

    IF v_tech_id IS NOT NULL THEN
        v_status := 'despachado';
    ELSE
        v_status := 'aberto'; -- Fila de exceção para atribuição manual pela Central
    END IF;

    -- Inserção atômica do chamado
    INSERT INTO public.tickets (
        protocol,
        tracking_token,
        school_id,
        category_id,
        requester_name,
        requester_role,
        requester_phone,
        title,
        description,
        equipment_patrimony,
        urgency_level,
        status,
        assigned_technician_id,
        created_at,
        updated_at
    ) VALUES (
        v_protocol,
        v_tracking_token,
        p_school_id,
        p_category_id,
        p_requester_name,
        p_requester_role,
        p_requester_phone,
        p_title,
        p_description,
        p_equipment_patrimony,
        p_urgency_level,
        v_status,
        v_tech_id,
        NOW(),
        NOW()
    ) RETURNING id INTO v_ticket_id;

    -- Registro do evento inicial na trilha central de auditoria
    INSERT INTO public.ticket_audit_events (
        ticket_id,
        actor_type,
        event_type,
        previous_status,
        new_status,
        metadata,
        created_at
    ) VALUES (
        v_ticket_id,
        'escola',
        'abertura_chamado',
        NULL,
        v_status,
        jsonb_build_object(
            'requester_name', p_requester_name,
            'requester_role', p_requester_role,
            'school_name', v_school.name,
            'assigned_technician_id', v_tech_id,
            'initial_status', v_status
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'ticket_id', v_ticket_id,
        'protocol', v_protocol,
        'tracking_token', v_tracking_token,
        'status', v_status,
        'assigned_technician_id', v_tech_id
    );
END;
$$;

-- 6. RPC accept_dispatch (Aceite de Despacho com Agendamento Opcional)
CREATE OR REPLACE FUNCTION public.accept_dispatch(
    p_ticket_id UUID,
    p_scheduled_visit_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_curr RECORD;
    v_next_status VARCHAR(30);
BEGIN
    SELECT id, status, assigned_technician_id INTO v_curr 
    FROM public.tickets 
    WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamado % não encontrado.', p_ticket_id;
    END IF;

    v_next_status := CASE WHEN p_scheduled_visit_date IS NOT NULL THEN 'visita_agendada' ELSE 'em_deslocamento' END;
    PERFORM public.assert_valid_ticket_transition(v_curr.status, v_next_status);

    UPDATE public.tickets 
    SET status = v_next_status,
        scheduled_visit_date = p_scheduled_visit_date,
        updated_at = NOW()
    WHERE id = p_ticket_id;

    INSERT INTO public.ticket_audit_events (
        ticket_id, actor_type, event_type, previous_status, new_status, metadata, created_at
    ) VALUES (
        p_ticket_id, 'tecnico', 'aceite_despacho', v_curr.status, v_next_status,
        jsonb_build_object('scheduled_visit_date', p_scheduled_visit_date),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'status', v_next_status);
END;
$$;

-- 7. RPC refuse_dispatch (Recusa com Re-despacho Geodésico Imediato)
CREATE OR REPLACE FUNCTION public.refuse_dispatch(
    p_ticket_id UUID,
    p_reason TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_curr RECORD;
    v_school RECORD;
    v_next_tech UUID := NULL;
    v_next_status VARCHAR(30);
BEGIN
    SELECT t.id, t.status, t.assigned_technician_id, t.school_id 
    INTO v_curr 
    FROM public.tickets t
    WHERE t.id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamado % não encontrado.', p_ticket_id;
    END IF;

    SELECT latitude, longitude INTO v_school FROM public.schools WHERE id = v_curr.school_id;

    -- Tenta encontrar o próximo técnico elegível excluindo quem recusou
    SELECT technician_id INTO v_next_tech
    FROM public.get_best_candidate_technician(
        v_school.latitude, 
        v_school.longitude, 
        ARRAY[v_curr.assigned_technician_id]::UUID[]
    )
    LIMIT 1;

    IF v_next_tech IS NOT NULL THEN
        v_next_status := 'despachado';
    ELSE
        v_next_status := 'aberto'; -- Fila de exceção para a Central
    END IF;

    UPDATE public.tickets 
    SET status = v_next_status,
        assigned_technician_id = v_next_tech,
        updated_at = NOW()
    WHERE id = p_ticket_id;

    INSERT INTO public.ticket_audit_events (
        ticket_id, actor_type, event_type, previous_status, new_status, metadata, created_at
    ) VALUES (
        p_ticket_id, 'tecnico', 'recusa_despacho', v_curr.status, v_next_status,
        jsonb_build_object(
            'refused_by_technician_id', v_curr.assigned_technician_id,
            'reason', p_reason,
            'reassigned_technician_id', v_next_tech
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true, 
        'status', v_next_status, 
        'assigned_technician_id', v_next_tech
    );
END;
$$;

-- 8. RPC check_in (Chegada na Escola e Início do Atendimento Presencial)
CREATE OR REPLACE FUNCTION public.check_in(
    p_ticket_id UUID,
    p_latitude FLOAT DEFAULT NULL,
    p_longitude FLOAT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_curr RECORD;
BEGIN
    SELECT id, status INTO v_curr FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamado % não encontrado.', p_ticket_id;
    END IF;

    PERFORM public.assert_valid_ticket_transition(v_curr.status, 'em_atendimento');

    UPDATE public.tickets 
    SET status = 'em_atendimento',
        arrival_time = COALESCE(arrival_time, NOW()),
        updated_at = NOW()
    WHERE id = p_ticket_id;

    INSERT INTO public.ticket_audit_events (
        ticket_id, actor_type, event_type, previous_status, new_status, metadata, created_at
    ) VALUES (
        p_ticket_id, 'tecnico', 'check_in_presencial', v_curr.status, 'em_atendimento',
        jsonb_build_object('lat', p_latitude, 'lng', p_longitude, 'arrival_time', NOW()),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'status', 'em_atendimento');
END;
$$;

-- 9. RPC submit_quote (Envio de Orçamento de Peças e Serviços pelo Técnico)
CREATE OR REPLACE FUNCTION public.submit_quote(
    p_ticket_id UUID,
    p_technician_id UUID,
    p_parts_cost NUMERIC,
    p_labor_cost NUMERIC,
    p_justification TEXT,
    p_parts_list JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_curr RECORD;
    v_total NUMERIC := (COALESCE(p_parts_cost, 0) + COALESCE(p_labor_cost, 0));
    v_quote_id UUID;
BEGIN
    SELECT id, status INTO v_curr FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamado % não encontrado.', p_ticket_id;
    END IF;

    PERFORM public.assert_valid_ticket_transition(v_curr.status, 'aguardando_orcamento');

    INSERT INTO public.ticket_quotes (
        ticket_id, technician_id, status, total_amount, parts_cost, labor_cost, justification, parts_list, created_at, updated_at
    ) VALUES (
        p_ticket_id, p_technician_id, 'pendente', v_total, p_parts_cost, p_labor_cost, p_justification, p_parts_list, NOW(), NOW()
    ) RETURNING id INTO v_quote_id;

    UPDATE public.tickets 
    SET status = 'aguardando_orcamento',
        updated_at = NOW()
    WHERE id = p_ticket_id;

    INSERT INTO public.ticket_audit_events (
        ticket_id, actor_type, event_type, previous_status, new_status, metadata, created_at
    ) VALUES (
        p_ticket_id, 'tecnico', 'envio_orcamento', v_curr.status, 'aguardando_orcamento',
        jsonb_build_object('quote_id', v_quote_id, 'total_amount', v_total),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'quote_id', v_quote_id, 'status', 'aguardando_orcamento');
END;
$$;

-- 10. RPC decide_quote (Decisão da Controladoria: Aprovação ou Reprovação)
CREATE OR REPLACE FUNCTION public.decide_quote(
    p_ticket_id UUID,
    p_quote_id UUID,
    p_decision VARCHAR, -- 'aprovado' ou 'reprovado'
    p_decision_reason TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_curr RECORD;
    v_next_status VARCHAR(30);
BEGIN
    SELECT id, status INTO v_curr FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamado % não encontrado.', p_ticket_id;
    END IF;

    IF p_decision = 'aprovado' THEN
        v_next_status := 'em_atendimento';
    ELSE
        v_next_status := 'cancelado';
    END IF;

    PERFORM public.assert_valid_ticket_transition(v_curr.status, v_next_status);

    UPDATE public.ticket_quotes 
    SET status = p_decision,
        justification = COALESCE(p_decision_reason, justification),
        updated_at = NOW()
    WHERE id = p_quote_id;

    UPDATE public.tickets 
    SET status = v_next_status,
        updated_at = NOW()
    WHERE id = p_ticket_id;

    INSERT INTO public.ticket_audit_events (
        ticket_id, actor_type, event_type, previous_status, new_status, metadata, created_at
    ) VALUES (
        p_ticket_id, 'controladoria', 'decisao_orcamento', v_curr.status, v_next_status,
        jsonb_build_object('quote_id', p_quote_id, 'decision', p_decision, 'reason', p_decision_reason),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'status', v_next_status, 'decision', p_decision);
END;
$$;

-- 11. RPC complete_ticket (Conclusão de OS com Laudo, Documento do Gestor e Assinatura Digital)
CREATE OR REPLACE FUNCTION public.complete_ticket(
    p_ticket_id UUID,
    p_technical_report TEXT,
    p_closure_notes TEXT,
    p_school_representative_doc VARCHAR,
    p_school_signature_svg TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_curr RECORD;
BEGIN
    SELECT id, status INTO v_curr FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamado % não encontrado.', p_ticket_id;
    END IF;

    IF p_school_signature_svg IS NULL OR LENGTH(TRIM(p_school_signature_svg)) < 20 THEN
        RAISE EXCEPTION 'A assinatura digital do gestor escolar é obrigatória para homologação da OS.';
    END IF;

    PERFORM public.assert_valid_ticket_transition(v_curr.status, 'concluido');

    UPDATE public.tickets 
    SET status = 'concluido',
        technical_report = p_technical_report,
        closure_notes = p_closure_notes,
        school_representative_doc = p_school_representative_doc,
        school_signature_svg = p_school_signature_svg,
        updated_at = NOW()
    WHERE id = p_ticket_id;

    INSERT INTO public.ticket_audit_events (
        ticket_id, actor_type, event_type, previous_status, new_status, metadata, created_at
    ) VALUES (
        p_ticket_id, 'tecnico', 'conclusao_atendimento', v_curr.status, 'concluido',
        jsonb_build_object(
            'has_report', p_technical_report IS NOT NULL,
            'school_rep_doc', p_school_representative_doc
        ),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'status', 'concluido');
END;
$$;

-- 12. RPC redispatch_expired_tickets (Timeout de 20 min com Re-despacho Automatizado no Banco)
CREATE OR REPLACE FUNCTION public.redispatch_expired_tickets()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r RECORD;
    v_next_tech UUID;
    v_count INTEGER := 0;
BEGIN
    FOR r IN
        SELECT t.id, t.assigned_technician_id, s.latitude, s.longitude
        FROM public.tickets t
        JOIN public.schools s ON s.id = t.school_id
        WHERE t.status = 'despachado'
          AND t.updated_at < (NOW() - INTERVAL '20 minutes')
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Tenta re-despachar para o próximo técnico excluindo o técnico que estourou o timeout
        SELECT technician_id INTO v_next_tech
        FROM public.get_best_candidate_technician(r.latitude, r.longitude, ARRAY[r.assigned_technician_id]::UUID[])
        LIMIT 1;

        IF v_next_tech IS NOT NULL THEN
            UPDATE public.tickets
            SET assigned_technician_id = v_next_tech,
                updated_at = NOW()
            WHERE id = r.id;

            INSERT INTO public.ticket_audit_events (
                ticket_id, actor_type, event_type, previous_status, new_status, metadata, created_at
            ) VALUES (
                r.id, 'sistema', 'timeout_despacho_redispatch', 'despachado', 'despachado',
                jsonb_build_object(
                    'timed_out_tech_id', r.assigned_technician_id,
                    'reassigned_tech_id', v_next_tech
                ),
                NOW()
            );
        ELSE
            -- Sem técnicos disponíveis: direciona para fila de exceção manual da Central
            UPDATE public.tickets
            SET status = 'aberto',
                assigned_technician_id = NULL,
                updated_at = NOW()
            WHERE id = r.id;

            INSERT INTO public.ticket_audit_events (
                ticket_id, actor_type, event_type, previous_status, new_status, metadata, created_at
            ) VALUES (
                r.id, 'sistema', 'timeout_despacho_fila_excecao', 'despachado', 'aberto',
                jsonb_build_object(
                    'timed_out_tech_id', r.assigned_technician_id,
                    'action', 'movido_para_central'
                ),
                NOW()
            );
        END IF;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

