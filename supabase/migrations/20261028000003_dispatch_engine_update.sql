-- ============================================================================
-- MIGRATION 03: Motor de Despacho Inteligente & Seed Inicial Idempotente
-- HelpTech Informática • Gestão e Despacho de TI
-- ============================================================================

-- ATUALIZAÇÃO DA FUNÇÃO RPC DE DESPACHO COM TODOS OS STATUS ATIVOS CONSIDERADOS
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
        -- Considera TODOS os status que consomem a capacidade ativa do técnico
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

-- SEED IDEMPOTENTE: 15 COORDENAÇÕES REGIONAIS DE ENSINO (CRES DO DF)
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

-- SEED IDEMPOTENTE: CATEGORIAS TÉCNICAS E MATRIZ DE SLA OFICIAL
INSERT INTO ticket_categories (name, sla_response_hours, sla_resolution_hours) VALUES
('Rede & Conectividade de Internet', 2, 24),
('Laboratório de Informática / Computadores', 4, 48),
('Projetores & Telas Interativas', 4, 48),
('Impressoras & Scanners Administrativos', 8, 72),
('Servidores & Roteadores Wi-Fi', 2, 12),
('Elétrica de TI / No-breaks & Nobreaks', 2, 24)
ON CONFLICT DO NOTHING;

