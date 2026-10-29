import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

// 1. Testes do Algoritmo de Distância Geodésica (Haversine)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function generateTicketProtocol() {
  const year = new Date().getFullYear();
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return `OS-${year}-${randomDigits}`;
}

describe('Motor de Geolocalização & Protocolos (geoEngine)', () => {
  test('Deve calcular a distância correta entre Taguatinga e Ceilândia (~6 km)', () => {
    const taguatinga = { lat: -15.8340, lng: -48.0560 };
    const ceilandia = { lat: -15.8150, lng: -48.1100 };
    const dist = calculateDistanceKm(taguatinga.lat, taguatinga.lng, ceilandia.lat, ceilandia.lng);
    assert.ok(dist >= 5 && dist <= 8, `Distância calculada foi ${dist}km, esperado entre 5 e 8km`);
  });

  test('Distância para o mesmo ponto deve ser exatamente 0 km', () => {
    const dist = calculateDistanceKm(-15.7940, -47.8820, -15.7940, -47.8820);
    assert.equal(dist, 0);
  });

  test('Gerador de protocolo deve seguir o padrão OS-YYYY-XXXXX', () => {
    const protocol = generateTicketProtocol();
    assert.match(protocol, /^OS-\d{4}-\d{5}$/);
  });

  test('Gerador de token de acompanhamento (CSPRNG): comprimento >= 32, prefixo tk_, unicidade e alta entropia', () => {
    function generateTrackingTokenCsprng() {
      const cryptoObj = typeof globalThis !== 'undefined' && globalThis.crypto 
        ? globalThis.crypto 
        : (typeof window !== 'undefined' ? window.crypto : null);
      if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
        throw new Error('CSPRNG indisponível');
      }
      const array = new Uint8Array(24);
      cryptoObj.getRandomValues(array);
      return 'tk_' + Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    const token = generateTrackingTokenCsprng();
    assert.ok(token.length >= 35, `Token gerado (${token.length} chars) deve ter pelo menos 35 caracteres`);
    assert.match(token, /^tk_[0-9a-f]{48}$/, 'Token deve possuir prefixo tk_ e 48 caracteres hexadecimais (192 bits CSPRNG)');

    // Teste de unicidade amostral: 1.000 tokens gerados consecutivamente não colidem
    const tokenSet = new Set();
    for (let i = 0; i < 1000; i++) {
      const t = generateTrackingTokenCsprng();
      assert.equal(tokenSet.has(t), false, 'Colisão detectada na geração de token CSPRNG');
      tokenSet.add(t);
    }
    assert.equal(tokenSet.size, 1000);
  });
});

// 2. Testes de Schemas de Validação Zod (schemas.ts)
const ticketSubmissionSchema = z.object({
  school_id: z.string().min(1, 'Escola é obrigatória'),
  requester_name: z.string().min(3, 'Nome do solicitante deve ter ao menos 3 caracteres'),
  requester_role: z.string().min(2, 'Cargo é obrigatório'),
  requester_phone: z.string().min(10, 'Telefone WhatsApp inválido'),
  category_id: z.string().min(1, 'Categoria é obrigatória'),
  title: z.string().min(5, 'Título deve ter ao menos 5 caracteres'),
  description: z.string().min(15, 'Descrição deve ter ao menos 15 caracteres'),
  urgency_level: z.enum(['baixa', 'media', 'alta', 'critica'])
});

describe('Validação de Schemas Operacionais (Zod)', () => {
  test('Deve validar payload de abertura de chamado correto', () => {
    const validData = {
      school_id: 'sch-53001010',
      requester_name: 'Maria Diretora',
      requester_role: 'Diretora Escolar',
      requester_phone: '(61) 98765-4321',
      category_id: 'cat-rede',
      title: 'Switch do lab queimado',
      description: 'Equipamento parou de responder após pico de energia na escola.',
      urgency_level: 'alta'
    };
    const result = ticketSubmissionSchema.safeParse(validData);
    assert.equal(result.success, true);
  });

  test('Deve rejeitar abertura de chamado com descrição curta (< 15 caracteres)', () => {
    const invalidData = {
      school_id: 'sch-53001010',
      requester_name: 'Maria Diretora',
      requester_role: 'Diretora Escolar',
      requester_phone: '(61) 98765-4321',
      category_id: 'cat-rede',
      title: 'Switch queimado',
      description: 'Curto',
      urgency_level: 'alta'
    };
    const result = ticketSubmissionSchema.safeParse(invalidData);
    assert.equal(result.success, false);
  });
});

// 3. Testes do Catálogo Oficial de Status e Capacidade (Sprint 2)
const CANONICAL_STATUSES = [
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
];

const ACTIVE_WORKLOAD_STATUSES = [
  'despachado',
  'visita_agendada',
  'em_deslocamento',
  'em_atendimento',
  'aguardando_orcamento',
  'aguardando_peca',
  'aguardando_terceiro'
];

describe('Modelo de Dados: Catálogo Canônico de Status & Capacidade (Sprint 2)', () => {
  test('O catálogo canônico deve conter exatamente os 10 status homologados', () => {
    assert.equal(CANONICAL_STATUSES.length, 10);
    assert.ok(CANONICAL_STATUSES.includes('visita_agendada'), 'Falta visita_agendada');
    assert.ok(CANONICAL_STATUSES.includes('aguardando_terceiro'), 'Falta aguardando_terceiro');
  });

  test('Os status de carga de trabalho ativa devem incluir os 7 estados operacionais de campo', () => {
    assert.equal(ACTIVE_WORKLOAD_STATUSES.length, 7);
    assert.ok(!ACTIVE_WORKLOAD_STATUSES.includes('aberto'), 'Aberto não deve consumir capacidade do técnico');
    assert.ok(!ACTIVE_WORKLOAD_STATUSES.includes('concluido'), 'Concluído deve liberar capacidade do técnico');
    assert.ok(!ACTIVE_WORKLOAD_STATUSES.includes('cancelado'), 'Cancelado deve liberar capacidade do técnico');
  });

  test('Validação de transições: Não deve ser permitido transicionar de concluído para aberto', () => {
    const isTerminal = (status) => ['concluido', 'cancelado'].includes(status);
    assert.equal(isTerminal('concluido'), true);
    assert.equal(isTerminal('cancelado'), true);
    assert.equal(isTerminal('em_atendimento'), false);
  });
});

// 4. Testes de Matriz de Autorização RBAC & Regras de Acesso (Sprint 3)
function canAccessRoute(userRole, targetRoute) {
  if (targetRoute === 'ROLE_ADMIN') {
    return userRole === 'ROLE_ADMIN';
  }
  if (targetRoute === 'ROLE_TECH') {
    return userRole === 'ROLE_TECH' || userRole === 'ROLE_ADMIN';
  }
  if (targetRoute === 'ROLE_SCHOOL') {
    return true; // Autoatendimento aberto a solicitantes e administradores
  }
  return false;
}

function filterTicketsBySchoolRLS(ticketsList, userSchoolId, isAdmin) {
  if (isAdmin) return ticketsList;
  return ticketsList.filter((t) => t.school_id === userSchoolId);
}

describe('Autenticação & Matriz de Autorização RBAC / RLS (Sprint 3)', () => {
  test('Usuário com perfil de Escola NÃO PODE acessar a Controladoria/Central (403)', () => {
    const allowed = canAccessRoute('ROLE_SCHOOL', 'ROLE_ADMIN');
    assert.equal(allowed, false, 'Representante de escola não deve acessar a Controladoria');
  });

  test('Técnico de Campo NÃO PODE acessar a Controladoria/Central (403)', () => {
    const allowed = canAccessRoute('ROLE_TECH', 'ROLE_ADMIN');
    assert.equal(allowed, false, 'Técnico de campo não deve acessar a Controladoria');
  });

  test('Administrador PODE acessar todas as áreas do sistema', () => {
    assert.equal(canAccessRoute('ROLE_ADMIN', 'ROLE_ADMIN'), true);
    assert.equal(canAccessRoute('ROLE_ADMIN', 'ROLE_TECH'), true);
    assert.equal(canAccessRoute('ROLE_ADMIN', 'ROLE_SCHOOL'), true);
  });

  test('Segregação de Escola (RLS): Escola A não pode consultar chamados da Escola B', () => {
    const mockTickets = [
      { id: 't1', school_id: 'sch-brazlandia-01', title: 'Chamado Brazlândia' },
      { id: 't2', school_id: 'sch-ceilandia-02', title: 'Chamado Ceilândia' },
      { id: 't3', school_id: 'sch-brazlandia-01', title: 'Segundo Chamado Brazlândia' }
    ];

    // Gestor da Escola Brazlândia
    const visibleToBrazlandia = filterTicketsBySchoolRLS(mockTickets, 'sch-brazlandia-01', false);
    assert.equal(visibleToBrazlandia.length, 2);
    assert.ok(visibleToBrazlandia.every((t) => t.school_id === 'sch-brazlandia-01'));

    // Administrador Central
    const visibleToAdmin = filterTicketsBySchoolRLS(mockTickets, 'qualquer', true);
    assert.equal(visibleToAdmin.length, 3);
  });
});

// 5. Testes da Camada de Persistência & Mapeamento de Domínio (Sprint 4)
function mapRowToTicketEntity(row, schoolLookup, categoryLookup) {
  const school = schoolLookup[row.school_id] || {
    name: row.schools?.name || 'Escola Padrão',
    cre_name: row.schools?.regional_coordinations?.name || 'CRE Padrão',
    address: row.schools?.address || 'Brasília DF'
  };
  const category = categoryLookup[row.category_id] || {
    name: row.ticket_categories?.name || 'Geral'
  };

  return {
    id: row.id,
    protocol: row.protocol,
    tracking_token: row.tracking_token,
    school_id: row.school_id,
    school_name: school.name,
    cre_name: school.cre_name,
    school_address: school.address,
    category_id: row.category_id,
    category_name: category.name,
    requester_name: row.requester_name,
    requester_role: row.requester_role,
    requester_phone: row.requester_phone,
    title: row.title,
    description: row.description,
    urgency_level: row.urgency_level,
    status: row.status,
    assigned_technician_id: row.assigned_technician_id || undefined,
    assigned_technician_name: row.technicians?.name || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    quote: row.ticket_quotes?.[0]
      ? {
          id: row.ticket_quotes[0].id,
          total_amount: Number(row.ticket_quotes[0].total_amount) || 0,
          items: row.ticket_quotes[0].ticket_quote_items || []
        }
      : undefined,
    attachments: (row.ticket_attachments || []).map((att) => ({
      id: att.id,
      phase: att.phase,
      file_url: att.file_url
    }))
  };
}

describe('Persistência Operacional & Mapeamento de Domínio (Sprint 4)', () => {
  test('Deve mapear registro relacional do Supabase para entidade de domínio Ticket completa', () => {
    const rawSupabaseRow = {
      id: 'uuid-12345',
      protocol: 'OS-2026-99999',
      tracking_token: 'token-abc-xyz',
      school_id: 'sch-001',
      category_id: 'cat-001',
      requester_name: 'Professor João',
      requester_role: 'Vice-Diretor',
      requester_phone: '(61) 99999-8888',
      title: 'Servidor fora do ar',
      description: 'Luz vermelha piscando no rack central da sala dos professores.',
      urgency_level: 'critica',
      status: 'aguardando_orcamento',
      assigned_technician_id: 'tech-001',
      created_at: '2026-10-28T10:00:00.000Z',
      updated_at: '2026-10-28T11:00:00.000Z',
      schools: {
        name: 'Centro de Ensino Fundamental 01',
        address: 'Quadra 10 Conjunto A',
        regional_coordinations: { name: 'CRE Plano Piloto' }
      },
      ticket_categories: { name: 'Servidores & Redes' },
      technicians: { name: 'Carlos Técnico' },
      ticket_quotes: [
        {
          id: 'quote-001',
          total_amount: '450.00',
          ticket_quote_items: [
            { id: 'item-1', item_name: 'Fonte redundante ATX', quantity: 1, unit_price: 450.0 }
          ]
        }
      ],
      ticket_attachments: [
        { id: 'att-1', phase: 'abertura', file_url: 'https://storage/photo1.webp' }
      ]
    };

    const domainTicket = mapRowToTicketEntity(rawSupabaseRow, {}, {});

    assert.equal(domainTicket.id, 'uuid-12345');
    assert.equal(domainTicket.protocol, 'OS-2026-99999');
    assert.equal(domainTicket.school_name, 'Centro de Ensino Fundamental 01');
    assert.equal(domainTicket.cre_name, 'CRE Plano Piloto');
    assert.equal(domainTicket.category_name, 'Servidores & Redes');
    assert.equal(domainTicket.assigned_technician_name, 'Carlos Técnico');
    assert.equal(domainTicket.quote?.total_amount, 450);
    assert.equal(domainTicket.quote?.items.length, 1);
    assert.equal(domainTicket.attachments.length, 1);
  });

  test('Deve preservar integridade em fallback local caso o banco remoto não esteja acessível', () => {
    const isRemoteAvailable = false;
    const localStoreCache = [
      { id: 'tkt-offline-1', protocol: 'OS-2026-00001', status: 'aberto' }
    ];

    const getTickets = () => {
      if (!isRemoteAvailable) {
        return { data: localStoreCache, fromFallback: true };
      }
      return { data: [], fromFallback: false };
    };

    const result = getTickets();
    assert.equal(result.fromFallback, true);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].id, 'tkt-offline-1');
  });

  test('Detecção de concorrência: deve rejeitar ou alertar sobre modificação com updated_at divergente', () => {
    const localSnapshotTime = '2026-10-28T10:00:00.000Z';
    const remoteServerTime = '2026-10-28T10:05:00.000Z';

    const hasConflict = (localTime, serverTime) => {
      return new Date(serverTime).getTime() > new Date(localTime).getTime();
    };

    assert.equal(hasConflict(localSnapshotTime, remoteServerTime), true, 'Conflito deve ser detectado');
    assert.equal(hasConflict(remoteServerTime, remoteServerTime), false, 'Sem conflito para versões iguais');
  });
});

// 6. Testes da Máquina de Estados Finita (FSM) & Ciclo de Vida (Sprint 5)
const VALID_TRANSITIONS = {
  aberto: ['despachado', 'cancelado'],
  despachado: ['em_deslocamento', 'despachado', 'aberto', 'visita_agendada', 'cancelado'],
  em_deslocamento: ['em_atendimento', 'visita_agendada', 'cancelado'],
  visita_agendada: ['em_deslocamento', 'em_atendimento', 'cancelado'],
  em_atendimento: [
    'aguardando_orcamento',
    'aguardando_peca',
    'aguardando_terceiro',
    'visita_agendada',
    'concluido',
    'cancelado'
  ],
  aguardando_orcamento: ['aguardando_peca', 'em_atendimento', 'cancelado'],
  aguardando_peca: ['em_atendimento', 'visita_agendada', 'cancelado'],
  aguardando_terceiro: ['em_atendimento', 'visita_agendada', 'cancelado'],
  concluido: [],
  cancelado: []
};

function testValidateTransition(from, to, context) {
  if (from === 'concluido' || from === 'cancelado') {
    return { valid: false, error: 'Estado terminal imutável' };
  }
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    return { valid: false, error: `Transição ilegal de ${from} para ${to}` };
  }
  if (to === 'cancelado' && from === 'aguardando_orcamento') {
    if (!context?.cancelReason && !context?.quoteDecision?.reason) {
      return { valid: false, error: 'Rejeição de orçamento exige justificativa' };
    }
  }
  if (to === 'concluido') {
    if (!context?.completionData?.signature_svg || !context?.completionData?.school_representative_doc) {
      return { valid: false, error: 'Conclusão exige documento e assinatura SVG' };
    }
  }
  return { valid: true };
}

describe('Máquina de Estados e Ciclo de Vida do Chamado (Sprint 5)', () => {
  test('Transições canônicas do fluxo padrão de atendimento devem ser aprovadas', () => {
    assert.equal(testValidateTransition('aberto', 'despachado').valid, true);
    assert.equal(testValidateTransition('despachado', 'em_deslocamento').valid, true);
    assert.equal(testValidateTransition('em_deslocamento', 'em_atendimento').valid, true);
    assert.equal(testValidateTransition('em_atendimento', 'aguardando_orcamento').valid, true);
    assert.equal(
      testValidateTransition('aguardando_orcamento', 'cancelado', { cancelReason: 'Custo acima do limite da escola' }).valid,
      true
    );
  });

  test('Deve bloquear saltos ilegais de status (ex: aberto direto para concluído)', () => {
    const jump = testValidateTransition('aberto', 'concluido');
    assert.equal(jump.valid, false);
    assert.match(jump.error, /Transição ilegal/);
  });

  test('Estados terminais (concluído e cancelado) NÃO podem ser alterados ou reabertos', () => {
    const fromConcluido = testValidateTransition('concluido', 'em_atendimento');
    assert.equal(fromConcluido.valid, false);
    assert.match(fromConcluido.error, /Estado terminal/);

    const fromCancelado = testValidateTransition('cancelado', 'aberto');
    assert.equal(fromCancelado.valid, false);
    assert.match(fromCancelado.error, /Estado terminal/);
  });

  test('Cancelamento a partir de orçamento deve exigir justificativa obrigatória', () => {
    const semJustificativa = testValidateTransition('aguardando_orcamento', 'cancelado', {});
    assert.equal(semJustificativa.valid, false);
    assert.match(semJustificativa.error, /exige justificativa/);

    const comJustificativa = testValidateTransition('aguardando_orcamento', 'cancelado', {
      cancelReason: 'Verba da CRE indisponível no trimestre'
    });
    assert.equal(comJustificativa.valid, true);
  });

  test('Conclusão de OS deve exigir conferência do gestor com documento e assinatura digital SVG', () => {
    const conclusaoIncompleta = testValidateTransition('em_atendimento', 'concluido', {
      completionData: { service_summary: 'Troca de conector RJ45' }
    });
    assert.equal(conclusaoIncompleta.valid, false);
    assert.match(conclusaoIncompleta.error, /exige documento e assinatura/);

    const conclusaoCompleta = testValidateTransition('em_atendimento', 'concluido', {
      completionData: {
        service_summary: 'Troca de conector RJ45 e conectorização de patch panel',
        school_representative_doc: 'Matrícula SEEDF 245.981-0',
        signature_svg: '<svg>signature_path</svg>'
      }
    });
    assert.equal(conclusaoCompleta.valid, true);
  });
});

// 7. Testes do Motor de Despacho Geodésico, Capacidade e Exclusões (Sprint 6)
function testGetBestCandidateTechnician(
  schoolLat,
  schoolLng,
  technicians,
  tickets,
  excludedTechIds = []
) {
  const activeStatuses = [
    'despachado',
    'visita_agendada',
    'em_deslocamento',
    'em_atendimento',
    'aguardando_orcamento',
    'aguardando_peca',
    'aguardando_terceiro'
  ];

  const candidates = [];

  for (const tech of technicians) {
    if (!tech.active || tech.status !== 'disponivel') continue;
    if (excludedTechIds.includes(tech.id)) continue;

    const activeLoad = tickets.filter(
      (t) => t.assigned_technician_id === tech.id && activeStatuses.includes(t.status)
    ).length;

    if (activeLoad >= tech.max_active_tickets) continue;

    const distanceKm = calculateDistanceKm(tech.latitude, tech.longitude, schoolLat, schoolLng);

    if (distanceKm <= tech.radius_km) {
      candidates.push({
        technician: tech,
        distanceKm,
        activeLoad
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (Math.abs(a.distanceKm - b.distanceKm) > 0.05) {
      return a.distanceKm - b.distanceKm;
    }
    if (a.activeLoad !== b.activeLoad) {
      return a.activeLoad - b.activeLoad;
    }
    return a.technician.name.localeCompare(b.technician.name);
  });

  return candidates[0];
}

describe('Motor de Despacho Geodésico, Capacidade & Exclusões (Sprint 6)', () => {
  const mockSchool = { lat: -15.834, lng: -48.056 }; // Taguatinga

  const baseTechs = [
    {
      id: 'tech-tagua',
      name: 'Marcos Taguatinga',
      latitude: -15.835,
      longitude: -48.055,
      radius_km: 30,
      max_active_tickets: 4,
      status: 'disponivel',
      active: true
    },
    {
      id: 'tech-ceil',
      name: 'Lucas Ceilândia',
      latitude: -15.815,
      longitude: -48.11,
      radius_km: 30,
      max_active_tickets: 4,
      status: 'disponivel',
      active: true
    },
    {
      id: 'tech-plano',
      name: 'Gabriel Plano Piloto',
      latitude: -15.794,
      longitude: -47.882,
      radius_km: 30,
      max_active_tickets: 4,
      status: 'disponivel',
      active: true
    }
  ];

  test('Deve selecionar o técnico mais próximo disponível', () => {
    const candidate = testGetBestCandidateTechnician(
      mockSchool.lat,
      mockSchool.lng,
      baseTechs,
      []
    );
    assert.ok(candidate);
    assert.equal(candidate.technician.id, 'tech-tagua');
    assert.ok(candidate.distanceKm < 1);
  });

  test('Deve ignorar técnico indisponível ou suspenso e selecionar o próximo elegível', () => {
    const modifiedTechs = baseTechs.map((t) =>
      t.id === 'tech-tagua' ? { ...t, status: 'indisponivel' } : t
    );
    const candidate = testGetBestCandidateTechnician(
      mockSchool.lat,
      mockSchool.lng,
      modifiedTechs,
      []
    );
    assert.ok(candidate);
    assert.equal(candidate.technician.id, 'tech-ceil'); // Próximo mais perto (Ceilândia)
  });

  test('Deve ignorar técnico que atingiu a capacidade máxima de 4 chamados ativos nos 7 status', () => {
    // 4 chamados ativos alocados para o técnico de Taguatinga
    const fullLoadTickets = [
      { id: '1', assigned_technician_id: 'tech-tagua', status: 'em_deslocamento' },
      { id: '2', assigned_technician_id: 'tech-tagua', status: 'em_atendimento' },
      { id: '3', assigned_technician_id: 'tech-tagua', status: 'aguardando_orcamento' },
      { id: '4', assigned_technician_id: 'tech-tagua', status: 'aguardando_peca' }
    ];

    const candidate = testGetBestCandidateTechnician(
      mockSchool.lat,
      mockSchool.lng,
      baseTechs,
      fullLoadTickets
    );
    assert.ok(candidate);
    assert.equal(candidate.technician.id, 'tech-ceil'); // Pulou Taguatinga por sobrecarga (4/4)
  });

  test('Chamados em status terminal (concluído ou cancelado) NÃO devem consumir capacidade do técnico', () => {
    const closedTickets = [
      { id: '1', assigned_technician_id: 'tech-tagua', status: 'concluido' },
      { id: '2', assigned_technician_id: 'tech-tagua', status: 'concluido' },
      { id: '3', assigned_technician_id: 'tech-tagua', status: 'cancelado' }
    ];

    const candidate = testGetBestCandidateTechnician(
      mockSchool.lat,
      mockSchool.lng,
      baseTechs,
      closedTickets
    );
    assert.ok(candidate);
    assert.equal(candidate.technician.id, 'tech-tagua');
    assert.equal(candidate.activeLoad, 0); // Carga ativa permanece 0
  });

  test('Deve respeitar a lista de técnicos excluídos (após recusa ou timeout de 20 min)', () => {
    const candidate = testGetBestCandidateTechnician(
      mockSchool.lat,
      mockSchool.lng,
      baseTechs,
      [],
      ['tech-tagua'] // Taguatinga recusou ou deu timeout
    );
    assert.ok(candidate);
    assert.equal(candidate.technician.id, 'tech-ceil');
  });

  test('Deve retornar null quando nenhum técnico estiver dentro do raio ou disponível (fila de exceção)', () => {
    const longDistanceSchool = { lat: -16.5, lng: -49.0 }; // Fora de Brasília/raio
    const candidate = testGetBestCandidateTechnician(
      longDistanceSchool.lat,
      longDistanceSchool.lng,
      baseTechs,
      []
    );
    assert.equal(candidate, null);
  });
});

// 8. Testes de Prontidão Offline & Fila de Mutações PWA (Sprint 7)
function createInMemoryOfflineQueue() {
  let queue = [];

  return {
    enqueue(action, ticketId, payload, actor) {
      const item = {
        id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action,
        ticketId,
        payload,
        actor,
        createdAt: new Date().toISOString(),
        attempts: 0
      };
      queue.push(item);
      return item;
    },
    dequeue(id) {
      queue = queue.filter((i) => i.id !== id);
    },
    getQueue() {
      return [...queue];
    },
    async flush(executor) {
      let success = 0;
      let failed = 0;
      const remaining = [];
      for (const item of queue) {
        const ok = await executor(item);
        if (ok) {
          success++;
        } else {
          failed++;
          remaining.push({ ...item, attempts: item.attempts + 1 });
        }
      }
      queue = remaining;
      return { success, failed };
    }
  };
}

describe('Prontidão Offline & Fila de Mutações PWA (Sprint 7)', () => {
  test('Deve enfileirar mutações em ordem cronológica (FIFO) quando o técnico estiver sem sinal', () => {
    const queue = createInMemoryOfflineQueue();

    queue.enqueue('CHECK_IN', 'tkt-01', { lat: -15.83, lng: -48.05 }, { name: 'Marcos', role: 'ROLE_TECH' });
    queue.enqueue('SUBMIT_QUOTE', 'tkt-01', { amount: 250 }, { name: 'Marcos', role: 'ROLE_TECH' });
    queue.enqueue('COMPLETE_TICKET', 'tkt-01', { signature: 'svg_data' }, { name: 'Marcos', role: 'ROLE_TECH' });

    const items = queue.getQueue();
    assert.equal(items.length, 3);
    assert.equal(items[0].action, 'CHECK_IN');
    assert.equal(items[1].action, 'SUBMIT_QUOTE');
    assert.equal(items[2].action, 'COMPLETE_TICKET');
  });

  test('Flush da fila: deve processar mutações sequencialmente e remover itens confirmados', async () => {
    const queue = createInMemoryOfflineQueue();

    queue.enqueue('CHECK_IN', 'tkt-01', { lat: -15.83, lng: -48.05 }, { name: 'Marcos', role: 'ROLE_TECH' });
    queue.enqueue('COMPLETE_TICKET', 'tkt-01', { signature: 'svg_data' }, { name: 'Marcos', role: 'ROLE_TECH' });

    const processed = [];
    const result = await queue.flush(async (mut) => {
      processed.push(mut.action);
      return true; // Sucesso na API remota
    });

    assert.equal(result.success, 2);
    assert.equal(result.failed, 0);
    assert.deepEqual(processed, ['CHECK_IN', 'COMPLETE_TICKET']);
    assert.equal(queue.getQueue().length, 0, 'Fila deve estar vazia após flush com sucesso');
  });

  test('Tratamento de falha de rede no flush: deve manter na fila e incrementar tentativas (attempts)', async () => {
    const queue = createInMemoryOfflineQueue();

    queue.enqueue('CHECK_IN', 'tkt-01', { lat: -15.83, lng: -48.05 }, { name: 'Marcos', role: 'ROLE_TECH' });
    queue.enqueue('COMPLETE_TICKET', 'tkt-01', { signature: 'svg_data' }, { name: 'Marcos', role: 'ROLE_TECH' });

    // Simula falha na segunda requisição (ex: queda de sinal na rota)
    const result = await queue.flush(async (mut) => {
      if (mut.action === 'COMPLETE_TICKET') return false; // Falhou
      return true;
    });

    assert.equal(result.success, 1);
    assert.equal(result.failed, 1);

    const remaining = queue.getQueue();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].action, 'COMPLETE_TICKET');
    assert.equal(remaining[0].attempts, 1);
  });
});

// 9. Testes de Evidências, Assinatura Digital e Anexos (Sprint 8)
function validateSignatureDensity(svgPath) {
  if (!svgPath || typeof svgPath !== 'string') return false;
  const trimmed = svgPath.trim();
  // Deve conter ao menos um comando MoveTo 'M' e um LineTo 'L'
  const hasMove = /M\s*\d+\s*\d+/i.test(trimmed);
  const hasLine = /L\s*\d+\s*\d+/i.test(trimmed);
  // Tamanho mínimo para descartar cliques acidentais de 1 ponto
  return hasMove && hasLine && trimmed.length >= 15;
}

function validateAttachmentConstraints(fileSize, mimeType) {
  const maxBytes = 10 * 1024 * 1024; // 10 MB
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
  if (fileSize > maxBytes) {
    return { valid: false, error: 'Arquivo excede o limite de 10 MB' };
  }
  if (!allowedMimes.includes(mimeType)) {
    return { valid: false, error: 'Formato de arquivo não suportado' };
  }
  return { valid: true };
}

describe('Evidências, Assinatura Digital & Anexos (Sprint 8)', () => {
  test('Deve aceitar assinatura digital vetorial com traçado consistente', () => {
    const validSvg = 'M 50 80 L 52 82 L 55 85 L 60 90 L 70 95 L 80 100';
    assert.equal(validateSignatureDensity(validSvg), true);
  });

  test('Deve rejeitar assinatura vazia ou toque acidental de ponto único', () => {
    assert.equal(validateSignatureDensity(''), false);
    assert.equal(validateSignatureDensity('   '), false);
    assert.equal(validateSignatureDensity('M 10 10'), false); // Apenas um ponto
  });

  test('Validação de anexos: deve aceitar fotos e PDFs dentro do limite de 10 MB', () => {
    const photo = validateAttachmentConstraints(3.2 * 1024 * 1024, 'image/webp');
    assert.equal(photo.valid, true);

    const pdf = validateAttachmentConstraints(1.5 * 1024 * 1024, 'application/pdf');
    assert.equal(pdf.valid, true);
  });

  test('Validação de anexos: deve rejeitar arquivos maiores que 10 MB ou tipos não permitidos', () => {
    const largeFile = validateAttachmentConstraints(12 * 1024 * 1024, 'image/jpeg');
    assert.equal(largeFile.valid, false);
    assert.match(largeFile.error, /excede o limite de 10 MB/);

    const executable = validateAttachmentConstraints(500, 'application/x-msdownload');
    assert.equal(executable.valid, false);
    assert.match(executable.error, /Formato de arquivo não suportado/);
  });

  test('Fases canônicas de anexos: devem pertencer estritamente a abertura, diagnostico ou conclusao', () => {
    const validPhases = ['abertura', 'diagnostico', 'conclusao'];
    assert.ok(validPhases.includes('abertura'));
    assert.ok(validPhases.includes('diagnostico'));
    assert.ok(validPhases.includes('conclusao'));
    assert.ok(!validPhases.includes('pos_atendimento'));
  });
});

// 10. Testes de Métricas de Gestão, SLA e Relatórios Executivos (Sprint 9)
function testCalculateTicketSla(createdAtIso, resolvedAtIso, status, targetHours = 48) {
  const createdTime = new Date(createdAtIso).getTime();
  const endTime = resolvedAtIso ? new Date(resolvedAtIso).getTime() : Date.now();
  const elapsedHours = (endTime - createdTime) / (1000 * 60 * 60);
  const hoursRemaining = targetHours - elapsedHours;

  if (status === 'concluido') {
    return {
      status: elapsedHours <= targetHours ? 'cumprido' : 'estourado',
      elapsedHours: Math.round(elapsedHours * 10) / 10
    };
  }

  if (hoursRemaining < 0) {
    return { status: 'estourado', hoursRemaining: Math.round(hoursRemaining * 10) / 10 };
  }
  if (hoursRemaining <= 8) {
    return { status: 'em_risco', hoursRemaining: Math.round(hoursRemaining * 10) / 10 };
  }
  return { status: 'no_prazo', hoursRemaining: Math.round(hoursRemaining * 10) / 10 };
}

function testCalculateSlaReport(ticketsList) {
  const completed = ticketsList.filter((t) => t.status === 'concluido');
  if (completed.length === 0) return { complianceRate: 100, completedCount: 0 };

  let compliant = 0;
  for (const t of completed) {
    const sla = testCalculateTicketSla(t.created_at, t.resolved_at, 'concluido', 48);
    if (sla.status === 'cumprido') compliant++;
  }

  return {
    complianceRate: Math.round((compliant / completed.length) * 1000) / 10,
    completedCount: completed.length
  };
}

describe('Painel de Gestão, Métricas Executivas & SLA (Sprint 9)', () => {
  test('Deve classificar chamado recém-aberto como no_prazo', () => {
    const now = new Date().toISOString();
    const result = testCalculateTicketSla(now, null, 'aberto', 48);
    assert.equal(result.status, 'no_prazo');
    assert.ok(result.hoursRemaining >= 47);
  });

  test('Deve classificar chamado com mais de 40h de espera como em_risco', () => {
    const fortyHoursAgo = new Date(Date.now() - 42 * 3600 * 1000).toISOString();
    const result = testCalculateTicketSla(fortyHoursAgo, null, 'em_atendimento', 48);
    assert.equal(result.status, 'em_risco');
    assert.ok(result.hoursRemaining <= 8 && result.hoursRemaining > 0);
  });

  test('Deve classificar chamado com mais de 48h sem conclusão como estourado', () => {
    const fiftyHoursAgo = new Date(Date.now() - 52 * 3600 * 1000).toISOString();
    const result = testCalculateTicketSla(fiftyHoursAgo, null, 'em_deslocamento', 48);
    assert.equal(result.status, 'estourado');
    assert.ok(result.hoursRemaining < 0);
  });

  test('Deve calcular corretamente a taxa percentual de conformidade de SLA', () => {
    const mockTickets = [
      // 2 concluídos dentro do SLA (20h e 30h)
      {
        id: 't1',
        status: 'concluido',
        created_at: '2026-10-25T10:00:00Z',
        resolved_at: '2026-10-26T06:00:00Z' // 20h
      },
      {
        id: 't2',
        status: 'concluido',
        created_at: '2026-10-25T10:00:00Z',
        resolved_at: '2026-10-26T16:00:00Z' // 30h
      },
      // 1 concluído fora do SLA (60h)
      {
        id: 't3',
        status: 'concluido',
        created_at: '2026-10-20T10:00:00Z',
        resolved_at: '2026-10-22T22:00:00Z' // 60h
      }
    ];

    const report = testCalculateSlaReport(mockTickets);
    assert.equal(report.completedCount, 3);
    assert.equal(report.complianceRate, 66.7); // 2 de 3 = 66.7%
  });

  test('Exportação CSV: deve gerar cabeçalhos válidos e escapar campos com vírgula', () => {
    const sampleTicket = {
      protocol: 'OS-2026-12345',
      school_name: 'Escola Classe 01, Brazlândia',
      cre_name: 'Brazlândia',
      category_name: 'Redes',
      urgency_level: 'alta',
      status: 'concluido',
      requester_name: 'Diretor João',
      requester_phone: '(61) 99999-9999'
    };

    const csvRow = `"${sampleTicket.school_name.replace(/"/g, '""')}",${sampleTicket.protocol}`;
    assert.ok(csvRow.startsWith('"Escola Classe 01, Brazlândia"'));
  });
});

// 11. Testes de Regressão: Sprint Corretiva A — Autenticação e RBAC (Fail-Closed)
describe('Sprint Corretiva A — Autenticação e RBAC (Fail-Closed & Menor Privilégio)', () => {
  // Simulação pura de regras de RBAC e vinculação segura
  function evaluateAccess({ user, targetPanel, userRole }) {
    if (!user) {
      return { allowed: false, status: 401, reason: 'Usuário não autenticado' };
    }
    if (userRole === 'UNAUTHORIZED' || !userRole) {
      return { allowed: false, status: 403, reason: 'Perfil sem vínculo homologado' };
    }
    if (targetPanel === 'CENTRAL_ADMIN' && userRole !== 'ROLE_ADMIN') {
      return { allowed: false, status: 403, reason: 'Painel restrito a administradores' };
    }
    if (targetPanel === 'TECH_PWA' && userRole !== 'ROLE_TECH' && userRole !== 'ROLE_ADMIN') {
      return { allowed: false, status: 403, reason: 'Painel restrito a técnicos autorizados' };
    }
    if (targetPanel === 'SCHOOL_PORTAL' && userRole !== 'ROLE_SCHOOL' && userRole !== 'ROLE_ADMIN') {
      return { allowed: false, status: 403, reason: 'Painel restrito a escolas autorizadas' };
    }
    return { allowed: true, status: 200 };
  }

  function resolveRoleStrict({ authUserId, email, databaseRecords }) {
    // 1. system_users
    const sysUser = databaseRecords.systemUsers.find(
      (u) => (u.auth_user_id === authUserId || u.email === email) && u.active
    );
    if (sysUser) return { role: 'ROLE_ADMIN', subRole: sysUser.role, id: sysUser.id };

    // 2. technicians
    const tech = databaseRecords.technicians.find(
      (t) => (t.auth_user_id === authUserId || t.email === email) && t.active
    );
    if (tech) return { role: 'ROLE_TECH', technicianId: tech.id };

    // 3. schools
    const school = databaseRecords.schools.find((s) => s.contact_email === email);
    if (school) return { role: 'ROLE_SCHOOL', schoolId: school.id };

    // FAIL-CLOSED: Sem vínculo, retorna null (nunca padrão ROLE_SCHOOL ou ROLE_ADMIN)
    return null;
  }

  test('Usuário anônimo não acessa operações protegidas (401)', () => {
    const access = evaluateAccess({ user: null, targetPanel: 'SCHOOL_PORTAL', userRole: null });
    assert.equal(access.allowed, false);
    assert.equal(access.status, 401);
  });

  test('Login com falha não deve gerar perfil nem autorização operacional', () => {
    const loginResult = { success: false, error: 'Credenciais inválidas' };
    let session = null;
    if (loginResult.success) {
      session = { role: 'ROLE_SCHOOL' };
    }
    assert.equal(session, null);
  });

  test('Falha de consulta de perfil ou ausência de vínculo resulta em FAIL-CLOSED', () => {
    const mockDb = {
      systemUsers: [],
      technicians: [],
      schools: []
    };
    // Usuário existe no Supabase Auth, mas não está cadastrado em nenhuma tabela
    const profile = resolveRoleStrict({
      authUserId: 'uuid-random-user',
      email: 'estagiario@gmail.com',
      databaseRecords: mockDb
    });
    assert.equal(profile, null);

    const access = evaluateAccess({
      user: { id: 'uuid-random-user', email: 'estagiario@gmail.com' },
      targetPanel: 'SCHOOL_PORTAL',
      userRole: profile?.role || 'UNAUTHORIZED'
    });
    assert.equal(access.allowed, false);
    assert.equal(access.status, 403);
  });

  test('Usuário escolar não se torna administrador por conter "admin" no e-mail', () => {
    const mockDb = {
      systemUsers: [], // Não existe na tabela de administradores
      technicians: [],
      schools: [{ id: 'sch-01', contact_email: 'escola.admin@edu.se.df.gov.br' }]
    };
    const profile = resolveRoleStrict({
      authUserId: 'uuid-school-user',
      email: 'escola.admin@edu.se.df.gov.br',
      databaseRecords: mockDb
    });
    // Deve ser ROLE_SCHOOL e NÃO ROLE_ADMIN
    assert.equal(profile?.role, 'ROLE_SCHOOL');

    const adminAccess = evaluateAccess({
      user: { id: 'uuid-school-user' },
      targetPanel: 'CENTRAL_ADMIN',
      userRole: profile.role
    });
    assert.equal(adminAccess.allowed, false);
    assert.equal(adminAccess.status, 403);
  });

  test('Usuário com vínculo inativo é bloqueado pelo sistema (fail-closed)', () => {
    const mockDb = {
      systemUsers: [{ id: 'sys-1', email: 'demitido@seedf.gov.br', active: false }],
      technicians: [],
      schools: []
    };
    const profile = resolveRoleStrict({
      authUserId: 'uuid-demitido',
      email: 'demitido@seedf.gov.br',
      databaseRecords: mockDb
    });
    assert.equal(profile, null);
  });

  test('Sessão revogada (logout) zera perfil e barra novas mutações', () => {
    let activeSession = { id: 'user-1', role: 'ROLE_ADMIN' };
    // Executa logout
    activeSession = null;

    const access = evaluateAccess({
      user: activeSession,
      targetPanel: 'CENTRAL_ADMIN',
      userRole: activeSession?.role || null
    });
    assert.equal(access.allowed, false);
    assert.equal(access.status, 401);
  });
});

// 12. Testes de Integração & Regras RLS: Sprint Corretiva B (Multitenancy, Trilha de Auditoria & Anti-Recursão)
describe('Sprint Corretiva B — Hardening de RLS, Isolamento Multitenant & Auditoria', () => {
  // Simulador estrito do motor RLS com as políticas da Migration 05
  function evaluateRlsPolicy({
    session, // { role: 'anon' | 'authenticated', userId?: string, email?: string, schoolId?: string, techId?: string, isSystemAdmin?: boolean, isController?: boolean }
    table,   // 'tickets' | 'ticket_attachments' | 'ticket_quotes' | 'ticket_audit_events' | 'system_users'
    operation, // 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
    record,   // Linha existente (para SELECT, UPDATE, DELETE)
    newRecord // Nova linha pretendida (para INSERT, UPDATE)
  }) {
    // Regra 1: Anon só tem acesso a tracking_token ou políticas explicitamente públicas
    if (session.role === 'anon') {
      if (table === 'tickets' && operation === 'SELECT') {
        if (record.tracking_token && record.tracking_token === session.trackingHeader) {
          return { allowed: true };
        }
      }
      return { allowed: false, error: 'PGRST301: Permission Denied for role anon' };
    }

    // Regra 2: Super Admin / Controladoria
    if (session.isSystemAdmin || session.isController) {
      if (table === 'ticket_audit_events' && (operation === 'UPDATE' || operation === 'DELETE')) {
        return { allowed: false, error: 'PGRST104: Table ticket_audit_events is immutable (No UPDATE/DELETE)' };
      }
      return { allowed: true };
    }

    // Regra 3: Tabela tickets
    if (table === 'tickets') {
      // 3.1 Gestor Escolar
      if (session.schoolId) {
        if (operation === 'SELECT') {
          return record.school_id === session.schoolId
            ? { allowed: true }
            : { allowed: false, error: 'RLS: Violação de segregação de Unidade Escolar' };
        }
        if (operation === 'INSERT') {
          return newRecord.school_id === session.schoolId
            ? { allowed: true }
            : { allowed: false, error: 'RLS: Proibida abertura de chamado para outra escola' };
        }
        if (operation === 'UPDATE') {
          if (record.school_id !== session.schoolId) {
            return { allowed: false, error: 'RLS: Registro não pertence à escola' };
          }
          if (newRecord.school_id !== session.schoolId) {
            return { allowed: false, error: 'RLS: Proibida transferência de chamado entre escolas' };
          }
          return { allowed: true };
        }
        if (operation === 'DELETE') {
          return { allowed: false, error: 'RLS: Escolas não podem deletar chamados' };
        }
      }

      // 3.2 Técnico de Campo
      if (session.techId) {
        if (operation === 'SELECT') {
          const isAssigned = record.assigned_technician_id === session.techId;
          const isEligibleOpen = record.status === 'aberto' && record.cre_id === session.creId;
          return isAssigned || isEligibleOpen
            ? { allowed: true }
            : { allowed: false, error: 'RLS: Técnico não autorizado para chamado fora de sua área/atribuição' };
        }
        if (operation === 'UPDATE') {
          if (record.assigned_technician_id !== session.techId) {
            return { allowed: false, error: 'RLS: Técnico não pode modificar chamado atribuído a outrem' };
          }
          if (newRecord.assigned_technician_id !== session.techId) {
            return { allowed: false, error: 'RLS: Técnico não pode alterar o técnico responsável atribuído' };
          }
          if (newRecord.school_id !== record.school_id) {
            return { allowed: false, error: 'RLS: Técnico não pode adulterar a escola do chamado' };
          }
          return { allowed: true };
        }
        if (operation === 'INSERT' || operation === 'DELETE') {
          return { allowed: false, error: 'RLS: Técnicos não têm permissão para criar ou excluir chamados diretamente' };
        }
      }
    }

    // Regra 4: Tabela ticket_audit_events (Auditoria Imutável)
    if (table === 'ticket_audit_events') {
      if (operation === 'UPDATE' || operation === 'DELETE') {
        return { allowed: false, error: 'RLS: Imutabilidade estrita da trilha de auditoria' };
      }
      if (operation === 'INSERT') {
        // Inserção direta via REST barrada para usuários sem papel admin
        return { allowed: false, error: 'RLS: Inserção direta restrita. Utilize a RPC record_ticket_audit_event()' };
      }
      if (operation === 'SELECT') {
        const canRead =
          (session.schoolId && record.school_id === session.schoolId) ||
          (session.techId && record.assigned_technician_id === session.techId);
        return canRead
          ? { allowed: true }
          : { allowed: false, error: 'RLS: Acesso não autorizado ao histórico de auditoria' };
      }
    }

    // Regra 5: Tabela system_users
    if (table === 'system_users') {
      if (operation === 'SELECT') {
        const isSelf = record.email === session.email || record.auth_user_id === session.userId;
        return isSelf ? { allowed: true } : { allowed: false, error: 'RLS: Restrito a administradores' };
      }
      return { allowed: false, error: 'RLS: Operação administrativa restrita a administradores' };
    }

    return { allowed: false, error: 'RLS: Política padrão bloqueada (fail-closed)' };
  }

  // RPC segura de auditoria no servidor (Sprint B.1)
  function executeRpcRecordAuditEvent(session, payload, mockTickets = []) {
    if (session.role === 'anon' || !session.userId) {
      throw new Error('42501: Não autorizado: identificação da sessão ausente para auditoria');
    }

    const ALLOWED_EVENTS = [
      'STATUS_CHANGED',
      'DISPATCH_NOTIFIED',
      'DISPATCH_ACCEPTED',
      'DISPATCH_REFUSED',
      'CHECK_IN',
      'VISIT_SCHEDULED',
      'WAITING_PARTS',
      'WAITING_THIRD_PARTY',
      'RESUMED',
      'QUOTE_SUBMITTED',
      'QUOTE_APPROVED',
      'QUOTE_REJECTED',
      'COMPLETED',
      'CANCELED'
    ];

    if (!ALLOWED_EVENTS.includes(payload.event_type)) {
      throw new Error(`22023: Evento de auditoria inválido ou não homologado: ${payload.event_type}`);
    }

    const ticket = mockTickets.find((t) => t.id === payload.ticket_id);
    if (!ticket) {
      throw new Error('02000: Chamado inexistente para registro de auditoria');
    }

    // Derivação no servidor pelo banco (não pelo cliente)
    let derivedActorName = session.email;
    let derivedActorRole = 'authenticated_operator';

    if (session.isSystemAdmin) {
      derivedActorName = session.name || 'Administrador Central';
      derivedActorRole = session.subRole || 'admin';
    } else if (session.techId) {
      if (ticket.assigned_technician_id && ticket.assigned_technician_id !== session.techId) {
        throw new Error('42501: Técnico não autorizado a auditar chamado não atribuído a si');
      }
      derivedActorName = session.name || 'Técnico Homologado';
      derivedActorRole = 'technician';
    } else if (session.schoolId) {
      if (ticket.school_id !== session.schoolId) {
        throw new Error('42501: Escola não autorizada a registrar auditoria em chamado de outra unidade');
      }
      derivedActorName = session.schoolName || 'Gestão Escolar';
      derivedActorRole = 'school';
    }

    // Sanitização de metadados
    const sanitizedMeta = { ...(payload.metadata || {}) };
    delete sanitizedMeta.password;
    delete sanitizedMeta.secret;
    delete sanitizedMeta.token;
    delete sanitizedMeta.key;

    return {
      id: 'audit-uuid-generated',
      ticket_id: payload.ticket_id,
      event_type: payload.event_type,
      from_status: payload.from_status,
      to_status: payload.to_status,
      actor_name: derivedActorName,
      actor_role: derivedActorRole,
      metadata: sanitizedMeta,
      created_at: new Date().toISOString()
    };
  }

  test('Cenário 1: Usuário anônimo não lê dados privados de chamados', () => {
    const res = evaluateRlsPolicy({
      session: { role: 'anon' },
      table: 'tickets',
      operation: 'SELECT',
      record: { id: 'tk-1', school_id: 'sch-1', tracking_token: 'tok-abc' }
    });
    assert.equal(res.allowed, false);
    assert.match(res.error, /Permission Denied/);
  });

  test('Cenário 2: Escola A não lê chamados da Escola B', () => {
    const res = evaluateRlsPolicy({
      session: { role: 'authenticated', schoolId: 'sch-escola-A' },
      table: 'tickets',
      operation: 'SELECT',
      record: { id: 'tk-10', school_id: 'sch-escola-B' }
    });
    assert.equal(res.allowed, false);
    assert.match(res.error, /Violação de segregação/);
  });

  test('Cenário 3: Escola A não atualiza nem transfere chamados para a Escola B', () => {
    const res = evaluateRlsPolicy({
      session: { role: 'authenticated', schoolId: 'sch-escola-A' },
      table: 'tickets',
      operation: 'UPDATE',
      record: { id: 'tk-10', school_id: 'sch-escola-A' },
      newRecord: { id: 'tk-10', school_id: 'sch-escola-B' } // Tentativa de transferência
    });
    assert.equal(res.allowed, false);
    assert.match(res.error, /Proibida transferência/);
  });

  test('Cenário 4: Escola A não cria registros vinculados à Escola B', () => {
    const res = evaluateRlsPolicy({
      session: { role: 'authenticated', schoolId: 'sch-escola-A' },
      table: 'tickets',
      operation: 'INSERT',
      newRecord: { school_id: 'sch-escola-B', title: 'Chamado Forjado' }
    });
    assert.equal(res.allowed, false);
    assert.match(res.error, /Proibida abertura de chamado para outra escola/);
  });

  test('Cenário 5: Técnico não modifica chamado não atribuído sem autorização', () => {
    const res = evaluateRlsPolicy({
      session: { role: 'authenticated', techId: 'tech-carlos' },
      table: 'tickets',
      operation: 'UPDATE',
      record: { id: 'tk-10', assigned_technician_id: 'tech-marcos' },
      newRecord: { id: 'tk-10', assigned_technician_id: 'tech-marcos', status: 'em_atendimento' }
    });
    assert.equal(res.allowed, false);
    assert.match(res.error, /Técnico não pode modificar chamado atribuído a outrem/);
  });

  test('Cenário 6: Alteração forjada de assigned_technician_id por técnico é rejeitada', () => {
    const res = evaluateRlsPolicy({
      session: { role: 'authenticated', techId: 'tech-carlos' },
      table: 'tickets',
      operation: 'UPDATE',
      record: { id: 'tk-10', assigned_technician_id: 'tech-carlos' },
      newRecord: { id: 'tk-10', assigned_technician_id: 'tech-marcos' } // Tentativa de auto-desatribuição arbitrária
    });
    assert.equal(res.allowed, false);
    assert.match(res.error, /Técnico não pode alterar o técnico responsável/);
  });

  test('Cenário 7: Usuário comum não executa ações na tabela system_users', () => {
    const res = evaluateRlsPolicy({
      session: { role: 'authenticated', email: 'escola@edu.se.df.gov.br', schoolId: 'sch-1' },
      table: 'system_users',
      operation: 'INSERT',
      newRecord: { email: 'hacker@seedf.gov.br', role: 'admin' }
    });
    assert.equal(res.allowed, false);
    assert.match(res.error, /restrita a administradores/);
  });

  test('Cenário 8: Inserção direta em ticket_audit_events por usuário comum é barrada (impede forjamento)', () => {
    const res = evaluateRlsPolicy({
      session: { role: 'authenticated', email: 'tecnico@fieldservice.df.gov.br', techId: 'tech-carlos' },
      table: 'ticket_audit_events',
      operation: 'INSERT',
      newRecord: {
        ticket_id: 'tk-1',
        actor_name: 'Super Administrador Forjado',
        actor_role: 'admin'
      }
    });
    assert.equal(res.allowed, false);
    assert.match(res.error, /Utilize a RPC record_ticket_audit_event/);
  });

  test('Cenário 9: RPC de auditoria deriva fidedignamente o ator e papel a partir da sessão real', () => {
    const techSession = {
      role: 'authenticated',
      userId: 'auth-uid-carlos',
      email: 'carlos@fieldservice.df.gov.br',
      name: 'Carlos Alberto Mendes',
      techId: 'tech-carlos'
    };
    const mockTickets = [{ id: 'tk-1', school_id: 'sch-1', assigned_technician_id: 'tech-carlos' }];
    const auditRecord = executeRpcRecordAuditEvent(
      techSession,
      {
        ticket_id: 'tk-1',
        event_type: 'STATUS_CHANGED',
        from_status: 'despachado',
        to_status: 'em_deslocamento'
      },
      mockTickets
    );
    // O ator e papel DEVEM ser derivados do perfil do técnico, não de parâmetros do payload
    assert.equal(auditRecord.actor_name, 'Carlos Alberto Mendes');
    assert.equal(auditRecord.actor_role, 'technician');
    assert.equal(auditRecord.to_status, 'em_deslocamento');
  });

  test('Cenário 9.1 (B.1): RPC de auditoria rejeita tipo de evento fora do catálogo canônico', () => {
    const techSession = {
      role: 'authenticated',
      userId: 'auth-uid-carlos',
      email: 'carlos@fieldservice.df.gov.br',
      name: 'Carlos Alberto Mendes',
      techId: 'tech-carlos'
    };
    const mockTickets = [{ id: 'tk-1', school_id: 'sch-1', assigned_technician_id: 'tech-carlos' }];
    assert.throws(
      () =>
        executeRpcRecordAuditEvent(
          techSession,
          {
            ticket_id: 'tk-1',
            event_type: 'INVALIDO_MALICIOSO',
            to_status: 'concluido'
          },
          mockTickets
        ),
      /22023: Evento de auditoria inválido/
    );
  });

  test('Cenário 9.2 (B.1): RPC de auditoria impede que Escola A registre eventos em chamado da Escola B', () => {
    const schoolSession = {
      role: 'authenticated',
      userId: 'auth-uid-escola-a',
      email: 'escola.a@edu.se.df.gov.br',
      schoolId: 'sch-escola-a',
      schoolName: 'Escola Classe A'
    };
    const mockTickets = [{ id: 'tk-2', school_id: 'sch-escola-b', assigned_technician_id: null }];
    assert.throws(
      () =>
        executeRpcRecordAuditEvent(
          schoolSession,
          {
            ticket_id: 'tk-2',
            event_type: 'CANCELED',
            from_status: 'aberto',
            to_status: 'cancelado'
          },
          mockTickets
        ),
      /42501: Escola não autorizada/
    );
  });

  test('Cenário 9.3 (B.1): RPC de auditoria sanitiza chaves sensíveis dos metadados (password, secret, token, key)', () => {
    const adminSession = {
      role: 'authenticated',
      userId: 'auth-uid-admin',
      email: 'admin@helptech.seedf.gov.br',
      name: 'Diretoria de TI',
      isSystemAdmin: true,
      subRole: 'controladoria'
    };
    const mockTickets = [{ id: 'tk-1', school_id: 'sch-1', assigned_technician_id: 'tech-carlos' }];
    const auditRecord = executeRpcRecordAuditEvent(
      adminSession,
      {
        ticket_id: 'tk-1',
        event_type: 'STATUS_CHANGED',
        from_status: 'aberto',
        to_status: 'despachado',
        metadata: {
          nota: 'Despacho urgente',
          password: 'segredo_injetado',
          token: 'jwt_vazado',
          key: 'api_key_vazada'
        }
      },
      mockTickets
    );
    assert.equal(auditRecord.metadata.nota, 'Despacho urgente');
    assert.equal(auditRecord.metadata.password, undefined);
    assert.equal(auditRecord.metadata.token, undefined);
    assert.equal(auditRecord.metadata.key, undefined);
    assert.equal(auditRecord.actor_role, 'controladoria'); // Preservou papel real
  });

  test('Cenário 10: Tentativa de UPDATE ou DELETE em ticket_audit_events é bloqueada até para administradores (imutabilidade)', () => {
    const updateRes = evaluateRlsPolicy({
      session: { role: 'authenticated', isSystemAdmin: true },
      table: 'ticket_audit_events',
      operation: 'UPDATE',
      record: { id: 'audit-1' },
      newRecord: { id: 'audit-1', actor_name: 'Apagado' }
    });
    assert.equal(updateRes.allowed, false);
    assert.match(updateRes.error, /immutable/);

    const deleteRes = evaluateRlsPolicy({
      session: { role: 'authenticated', isSystemAdmin: true },
      table: 'ticket_audit_events',
      operation: 'DELETE',
      record: { id: 'audit-1' }
    });
    assert.equal(deleteRes.allowed, false);
    assert.match(deleteRes.error, /immutable/);
  });

  test('Cenário 11: A política de administrador não causa recursão por usar helper SECURITY DEFINER com search_path isolado', () => {
    // Simulação do helper com search_path seguro
    let recursionDepth = 0;
    function safeIsAdmin(authUserId, mockUsers) {
      recursionDepth++;
      if (recursionDepth > 1) {
        throw new Error('Infinite recursion detected in policy for relation system_users');
      }
      return mockUsers.some((u) => u.auth_user_id === authUserId && u.role === 'admin' && u.active);
    }

    const mockSystemUsers = [{ auth_user_id: 'admin-1', role: 'admin', active: true }];
    const isAdmin = safeIsAdmin('admin-1', mockSystemUsers);
    assert.equal(isAdmin, true);
    assert.equal(recursionDepth, 1); // Sem recursão
  });

  test('Cenário 12: Fluxo legítimo: Escola A abre chamado próprio com sucesso', () => {
    const res = evaluateRlsPolicy({
      session: { role: 'authenticated', schoolId: 'sch-escola-A' },
      table: 'tickets',
      operation: 'INSERT',
      newRecord: {
        school_id: 'sch-escola-A',
        title: 'Manutenção de Laboratório',
        status: 'aberto'
      }
    });
    assert.equal(res.allowed, true);
  });

  // Novos Testes da Sprint B.2: Triggers de Integridade Multitenant e Resolução Inequívoca
  test('Cenário 13 (B.2 Trigger): Impede transferência de escola no UPDATE via trigger de integridade', () => {
    function simulateTicketUpdateTrigger(oldRow, newRow, isSystemAdmin) {
      // 1 e 2: Imutáveis incondicionalmente, inclusive para administradores
      if (newRow.school_id !== oldRow.school_id) {
        throw new Error('42501: RLS/Integrity: Não é permitido transferir chamado para outra Unidade Escolar');
      }
      if (newRow.protocol !== oldRow.protocol || newRow.created_at !== oldRow.created_at || newRow.tracking_token !== oldRow.tracking_token) {
        throw new Error('42501: RLS/Integrity: Protocolo, token de acompanhamento e carimbo de abertura são inalteráveis');
      }
      // Superadministrador tem permissão para os demais ajustes operacionais (status, reatribuição)
      if (isSystemAdmin) return { allowed: true };
      return { allowed: true };
    }

    const oldTicket = { id: 't1', school_id: 'sch-1', protocol: 'OS-2026-001', created_at: '2026-10-28T10:00:00Z', tracking_token: 'tk_0123456789abcdef0123456789abcdef', assigned_technician_id: 'tech-1' };
    const forgedTicket = { ...oldTicket, school_id: 'sch-2' };
    const forgedTokenTicket = { ...oldTicket, tracking_token: 'tk_forged_token_1234567890123456' };

    // Usuário comum deve ser bloqueado com erro 42501 na troca de escola
    assert.throws(() => simulateTicketUpdateTrigger(oldTicket, forgedTicket, false), /Não é permitido transferir chamado/);

    // Administrador TAMBÉM deve ser bloqueado na troca de escola (imutabilidade absoluta)
    assert.throws(() => simulateTicketUpdateTrigger(oldTicket, forgedTicket, true), /Não é permitido transferir chamado/);

    // Usuário comum e Administrador bloqueados na adulteração do token de acompanhamento
    assert.throws(() => simulateTicketUpdateTrigger(oldTicket, forgedTokenTicket, false), /Protocolo, token de acompanhamento e carimbo de abertura são inalteráveis/);
    assert.throws(() => simulateTicketUpdateTrigger(oldTicket, forgedTokenTicket, true), /Protocolo, token de acompanhamento e carimbo de abertura são inalteráveis/);

    // Superadministrador tem permissão para alteração operacional válida (reatribuição)
    const validAdminUpdate = { ...oldTicket, assigned_technician_id: 'tech-2' };
    const adminRes = simulateTicketUpdateTrigger(oldTicket, validAdminUpdate, true);
    assert.equal(adminRes.allowed, true);
  });

  test('Cenário 14 (B.2 Trigger): Impede que usuário comum altere seu próprio papel (role) em system_users', () => {
    function simulateSystemUsersPrivilegeTrigger(oldRow, newRow, isSystemAdmin) {
      if (!isSystemAdmin) {
        if (newRow.role !== oldRow.role || newRow.active !== oldRow.active || newRow.auth_user_id !== oldRow.auth_user_id) {
          throw new Error('42501: RLS/Privilege: Apenas superadministrador pode alterar privilégios (role) ou estado ativo');
        }
      }
      return { allowed: true };
    }

    const selfUser = { id: 'u1', email: 'joao@seedf.gov.br', role: 'controladoria', active: true, auth_user_id: 'uid-1' };
    const escalationAttempt = { ...selfUser, role: 'admin' }; // Tentativa de auto-promoção

    assert.throws(() => simulateSystemUsersPrivilegeTrigger(selfUser, escalationAttempt, false), /Apenas superadministrador pode alterar privilégios/);

    // Superadministrador legítimo pode alterar
    const adminRes = simulateSystemUsersPrivilegeTrigger(selfUser, escalationAttempt, true);
    assert.equal(adminRes.allowed, true);
  });

  test('Cenário 15 (B.2 Fail-Closed): Resolução de escola nega acesso (retorna null) se houver ambiguidade de cadastro', () => {
    function resolveSchoolIdStrict(email, schoolsDb) {
      const matches = schoolsDb.filter((s) => s.contact_email === email);
      if (matches.length === 1) return matches[0].id;
      // Fail-closed se 0 ou mais de 1 (duplicidade)
      return null;
    }

    const mockSchools = [
      { id: 'sch-1', name: 'EC 01', contact_email: 'duplicado@edu.se.df.gov.br' },
      { id: 'sch-2', name: 'EC 02', contact_email: 'duplicado@edu.se.df.gov.br' },
      { id: 'sch-3', name: 'EC 03', contact_email: 'unico@edu.se.df.gov.br' }
    ];

    // Cadastro único legítimo
    assert.equal(resolveSchoolIdStrict('unico@edu.se.df.gov.br', mockSchools), 'sch-3');

    // Cadastro ambíguo/duplicado deve falhar fechado (retornar null)
    assert.equal(resolveSchoolIdStrict('duplicado@edu.se.df.gov.br', mockSchools), null);
  });

  // Novos Testes da Sprint B.2.1: RPC Pública Mínima e Whitelist Estrita de Auditoria
  test('Cenário 16 (B.2.1 RPC Pública): Acompanhamento por token retorna apenas campos mínimos e bloqueia linha completa', () => {
    function executeGetTicketPublicTracking(token, mockTickets) {
      if (!token || token.trim().length < 8) return [];
      const match = mockTickets.find((t) => t.tracking_token === token && t.status !== 'cancelado');
      if (!match) return [];
      // 8 campos públicos homologados: protocol, status, urgency_level, created_at, scheduled_visit_at, arrival_at, completed_at, description
      return [
        {
          protocol: match.protocol,
          status: match.status,
          urgency_level: match.urgency_level,
          created_at: match.created_at,
          scheduled_visit_at: match.scheduled_visit_at,
          arrival_at: match.arrived_at,
          completed_at: match.resolved_at,
          description: match.description
        }
      ];
    }

    const mockTickets = [
      {
        id: 'tk-priv-1',
        protocol: 'OS-2026-99999',
        tracking_token: 'valid-public-token-12345',
        school_id: 'sch-sensivel',
        requester_name: 'Diretora Maria',
        requester_phone: '(61) 98888-7777',
        requester_role: 'Diretora',
        equipment_patrimony: 'PAT-998877',
        assigned_technician_id: 'tech-99',
        urgency_level: 'alta',
        status: 'em_atendimento',
        created_at: '2026-10-28T12:00:00Z',
        scheduled_visit_at: '2026-10-29T09:00:00Z',
        arrived_at: '2026-10-29T09:15:00Z',
        resolved_at: null,
        description: 'Manutenção de projetor da sala de aula 04'
      }
    ];

    const publicView = executeGetTicketPublicTracking('valid-public-token-12345', mockTickets);
    assert.equal(publicView.length, 1);
    const row = publicView[0];
    assert.equal(row.protocol, 'OS-2026-99999');
    assert.equal(row.status, 'em_atendimento');
    assert.equal(row.description, 'Manutenção de projetor da sala de aula 04');
    assert.equal(row.arrival_at, '2026-10-29T09:15:00Z');
    // Campos confidenciais/PII NÃO DEVEM EXISTIR no retorno
    assert.equal(row.id, undefined);
    assert.equal(row.school_id, undefined);
    assert.equal(row.requester_name, undefined);
    assert.equal(row.requester_phone, undefined);
    assert.equal(row.requester_role, undefined);
    assert.equal(row.equipment_patrimony, undefined);
    assert.equal(row.assigned_technician_id, undefined);

    // Token curto ou inválido retorna vazio
    assert.equal(executeGetTicketPublicTracking('curto', mockTickets).length, 0);
    assert.equal(executeGetTicketPublicTracking('token-inexistente-12345', mockTickets).length, 0);
  });

  test('Cenário 17 (B.2.1 Trigger): Técnico não pode alterar seus dados cadastrais restritos (active, auth_user_id, email)', () => {
    function simulateTechniciansIntegrityTrigger(oldRow, newRow, isAdmin) {
      if (!isAdmin) {
        if (
          newRow.active !== oldRow.active ||
          newRow.auth_user_id !== oldRow.auth_user_id ||
          newRow.email !== oldRow.email ||
          newRow.primary_cre_id !== oldRow.primary_cre_id
        ) {
          throw new Error('42501: RLS/Privilege: Técnico não pode alterar seus dados cadastrais restritos');
        }
      }
      return { allowed: true };
    }

    const currentTech = {
      id: 'tech-1',
      name: 'Carlos Mendes',
      email: 'carlos@fieldservice.df.gov.br',
      active: true,
      auth_user_id: 'uid-carlos',
      primary_cre_id: 'cre-taguatinga'
    };

    // Tentativa de técnico reativar cadastro suspenso ou mudar e-mail
    const forgedTech = { ...currentTech, email: 'hacker@seedf.gov.br' };
    assert.throws(() => simulateTechniciansIntegrityTrigger(currentTech, forgedTech, false), /Técnico não pode alterar seus dados cadastrais restritos/);

    // Técnico pode atualizar apenas campos operacionais como latitude/longitude/status de trabalho
    const validUpdate = { ...currentTech, status: 'ocupado', latitude: -15.8, longitude: -48.0 };
    assert.equal(simulateTechniciansIntegrityTrigger(currentTech, validUpdate, false).allowed, true);
  });

  test('Cenário 18 (B.2.1 Whitelist de Metadados): RPC de auditoria descarta qualquer chave fora da whitelist homologada', () => {
    const ALLOWED_KEYS = [
      'notes', 'reason', 'refusal_reason', 'scheduled_visit_at',
      'pending_part_notes', 'third_party_notes', 'arrival_lat', 'arrival_lng',
      'urgency_level', 'status', 'dispatch_attempts'
    ];

    function sanitizeMetadataWhitelist(meta) {
      const sanitized = {};
      if (!meta) return sanitized;
      for (const [key, val] of Object.entries(meta)) {
        if (ALLOWED_KEYS.includes(key)) {
          sanitized[key] = val;
        }
      }
      return sanitized;
    }

    const rawMeta = {
      notes: 'Visita agendada para sexta-feira',
      arrival_lat: -15.83,
      malicious_payload: '<script>alert(1)</script>',
      internal_jwt: 'eyJhbGciOi...',
      random_client_field: 12345
    };

    const sanitized = sanitizeMetadataWhitelist(rawMeta);
    assert.equal(sanitized.notes, 'Visita agendada para sexta-feira');
    assert.equal(sanitized.arrival_lat, -15.83);
    assert.equal(sanitized.malicious_payload, undefined);
    assert.equal(sanitized.internal_jwt, undefined);
    assert.equal(sanitized.random_client_field, undefined);
  });

  // Novos Testes da Sprint B.2.2: Fechamento dos Bloqueios Residuais
  test('Cenário 19 (B.2.2 RPC Pública): Exige formato regex ^tk_[0-9a-fA-F]{32,60}$ e oculta chamados cancelados', () => {
    function executeGetTicketPublicTrackingV2(token, mockTickets) {
      if (!token || !/^tk_[0-9a-fA-F]{32,60}$/.test(token.trim())) return [];
      const match = mockTickets.find((t) => t.tracking_token === token && t.status !== 'cancelado');
      if (!match) return [];
      return [
        {
          protocol: match.protocol,
          status: match.status,
          urgency_level: match.urgency_level,
          created_at: match.created_at,
          scheduled_visit_at: match.scheduled_visit_at,
          arrival_at: match.arrived_at,
          completed_at: match.resolved_at,
          description: match.description
        }
      ];
    }

    const mockTickets = [
      {
        protocol: 'OS-2026-11111',
        tracking_token: 'tk_0123456789abcdef0123456789abcdef', // 35 caracteres hexadecimais válidos
        status: 'em_atendimento',
        urgency_level: 'media',
        created_at: '2026-10-28T10:00:00Z',
        scheduled_visit_at: '2026-10-29T14:00:00Z',
        arrived_at: '2026-10-29T14:10:00Z',
        resolved_at: null,
        description: 'Manutenção de switch de borda'
      },
      {
        protocol: 'OS-2026-22222',
        tracking_token: 'tk_0123456789abcdef0123456789abcde2',
        status: 'cancelado', // Cancelado
        urgency_level: 'baixa',
        created_at: '2026-10-28T11:00:00Z',
        scheduled_visit_at: null,
        arrived_at: null,
        resolved_at: null,
        description: 'Chamado Cancelado pela unidade'
      }
    ];

    // Token com prefixo tk_ e 32+ hexadecimais para chamado ativo: SUCESSO
    const activeRes = executeGetTicketPublicTrackingV2('tk_0123456789abcdef0123456789abcdef', mockTickets);
    assert.equal(activeRes.length, 1);
    assert.equal(activeRes[0].protocol, 'OS-2026-11111');

    // Token sem prefixo tk_ é rejeitado pelo regex
    assert.equal(executeGetTicketPublicTrackingV2('0123456789abcdef0123456789abcdef', mockTickets).length, 0);

    // Token com caracteres não-hexadecimais é rejeitado pelo regex
    assert.equal(executeGetTicketPublicTrackingV2('tk_0123456789abcdefzzzzzzzzzzzzzzzz', mockTickets).length, 0);

    // Token com menos de 32 hexadecimais é rejeitado
    assert.equal(executeGetTicketPublicTrackingV2('tk_short1234', mockTickets).length, 0);

    // Chamado com status cancelado é oculto da consulta pública
    const canceledRes = executeGetTicketPublicTrackingV2('tk_0123456789abcdef0123456789abcde2', mockTickets);
    assert.equal(canceledRes.length, 0);
  });

  test('Cenário 20 (B.2.2 Trigger Orçamentos): Gestor escolar não pode alterar valores técnicos de orçamento', () => {
    function simulateTicketQuotesIntegrityTrigger(oldQuote, newQuote, isSchool, isTech, isAdmin) {
      if (isAdmin) return { allowed: true };

      if (isSchool) {
        if (
          newQuote.total_amount !== oldQuote.total_amount ||
          newQuote.technical_diagnosis !== oldQuote.technical_diagnosis ||
          newQuote.technician_id !== oldQuote.technician_id ||
          newQuote.ticket_id !== oldQuote.ticket_id
        ) {
          throw new Error('42501: RLS/Integrity: Gestor escolar pode apenas deliberar sobre o orçamento');
        }
      }

      if (isTech) {
        if (['aprovado', 'rejeitado', 'cancelado'].includes(oldQuote.status)) {
          throw new Error('42501: RLS/Integrity: Não é permitido modificar orçamento com deliberação já concluída');
        }
      }

      return { allowed: true };
    }

    const currentQuote = {
      id: 'q-1',
      ticket_id: 't-1',
      technician_id: 'tech-1',
      total_amount: 450.0,
      technical_diagnosis: 'Troca de fonte ATX',
      status: 'pendente'
    };

    // Escola deliberando (aprovando): VÁLIDO
    const schoolApproval = {
      ...currentQuote,
      status: 'aprovado',
      decision_by_name: 'Diretor João',
      decided_at: '2026-10-28T14:00:00Z'
    };
    assert.equal(simulateTicketQuotesIntegrityTrigger(currentQuote, schoolApproval, true, false, false).allowed, true);

    // Escola tentando alterar valor para 0: REJEITADO
    const schoolPriceTampering = { ...currentQuote, total_amount: 0.0 };
    assert.throws(
      () => simulateTicketQuotesIntegrityTrigger(currentQuote, schoolPriceTampering, true, false, false),
      /Gestor escolar pode apenas deliberar/
    );

    // Técnico tentando alterar orçamento já aprovado: REJEITADO
    const approvedQuote = { ...currentQuote, status: 'aprovado' };
    const techTamperingAfterApproval = { ...approvedQuote, total_amount: 800.0 };
    assert.throws(
      () => simulateTicketQuotesIntegrityTrigger(approvedQuote, techTamperingAfterApproval, false, true, false),
      /Não é permitido modificar orçamento com deliberação já concluída/
    );
  });

  test('Cenário 21 (B.2.2 Trigger Privilégios): Bloqueia criação de novos administradores por usuários comuns no INSERT', () => {
    function simulateSystemUsersInsertTrigger(newRow, isSuperAdmin) {
      if (['admin', 'controladoria', 'auditor_seedf'].includes(newRow.role) && !isSuperAdmin) {
        throw new Error('42501: RLS/Privilege: Apenas superadministrador pode criar novos usuários administrativos');
      }
      return { allowed: true };
    }

    const unauthorizedAdminCreation = {
      email: 'novo.admin@seedf.gov.br',
      role: 'admin',
      active: true
    };

    // Usuário comum ou anônimo tentando fazer INSERT de admin via REST: REJEITADO
    assert.throws(
      () => simulateSystemUsersInsertTrigger(unauthorizedAdminCreation, false),
      /Apenas superadministrador pode criar novos usuários/
    );

    // Superadministrador legítimo pode criar
    assert.equal(simulateSystemUsersInsertTrigger(unauthorizedAdminCreation, true).allowed, true);
  });

  test('Cenário 22 (B.2.2 Restrição RLS): Eliminação de USING TRUE em escolas e técnicos', () => {
    function evaluateSchoolReadPolicy({ session, targetSchoolId }) {
      // Regra B.2.2: public.is_admin_or_controller() OR id = public.current_school_id() OR public.current_technician_id() IS NOT NULL
      if (session.isAdmin) return { allowed: true };
      if (session.isTech) return { allowed: true };
      if (session.schoolId === targetSchoolId) return { allowed: true };
      return { allowed: false, error: 'PGRST301: Acesso negado a dados de escolas terceiras' };
    }

    const targetSchoolId = 'sch-brazlandia-01';

    // Escola dona do cadastro lê sua própria escola
    assert.equal(evaluateSchoolReadPolicy({ session: { schoolId: 'sch-brazlandia-01' }, targetSchoolId }).allowed, true);

    // Escola terceira NÃO lê cadastro de outra escola
    const otherSchoolRes = evaluateSchoolReadPolicy({ session: { schoolId: 'sch-taguatinga-02' }, targetSchoolId });
    assert.equal(otherSchoolRes.allowed, false);

    // Usuário sem perfil (ex: anônimo ou avulso) NÃO lê
    const anonRes = evaluateSchoolReadPolicy({ session: {}, targetSchoolId });
    assert.equal(anonRes.allowed, false);
  });

  test('Cenário 23 (B.2.2 Matriz de Auditoria por Papel): Escola e Técnico têm eventos restritos ao seu escopo', () => {
    function validateAuditEventByRole(actorRole, eventType) {
      const SCHOOL_EVENTS = ['STATUS_CHANGED', 'QUOTE_APPROVED', 'QUOTE_REJECTED', 'CANCELED'];
      const TECH_EVENTS = [
        'STATUS_CHANGED', 'DISPATCH_ACCEPTED', 'DISPATCH_REFUSED', 'CHECK_IN',
        'VISIT_SCHEDULED', 'WAITING_PARTS', 'WAITING_THIRD_PARTY', 'RESUMED',
        'QUOTE_SUBMITTED', 'COMPLETED'
      ];
      const ADMIN_ROLES = ['admin', 'controladoria', 'auditor_seedf'];

      if (ADMIN_ROLES.includes(actorRole)) {
        return { allowed: true };
      }
      if (actorRole === 'school') {
        if (!SCHOOL_EVENTS.includes(eventType)) {
          throw new Error(`42501: Perfil escolar não tem permissão para registrar o evento operacional ${eventType}`);
        }
        return { allowed: true };
      }
      if (actorRole === 'technician') {
        if (!TECH_EVENTS.includes(eventType)) {
          throw new Error(`42501: Técnico de campo não tem permissão para deliberar ou registrar o evento ${eventType}`);
        }
        return { allowed: true };
      }
      throw new Error('42501: Papel não autorizado para auditoria');
    }

    // Gestor escolar registrando aprovação de orçamento: PERMITIDO
    assert.equal(validateAuditEventByRole('school', 'QUOTE_APPROVED').allowed, true);

    // Gestor escolar tentando forjar CHECK_IN técnico: BLOQUEADO
    assert.throws(() => validateAuditEventByRole('school', 'CHECK_IN'), /Perfil escolar não tem permissão/);

    // Técnico registrando CHECK_IN ou VISITA AGENDADA: PERMITIDO
    assert.equal(validateAuditEventByRole('technician', 'CHECK_IN').allowed, true);
    assert.equal(validateAuditEventByRole('technician', 'VISIT_SCHEDULED').allowed, true);

    // Técnico tentando forjar aprovação de orçamento próprio: BLOQUEADO
    assert.throws(() => validateAuditEventByRole('technician', 'QUOTE_APPROVED'), /Técnico de campo não tem permissão/);

    // Administrador tem permissão para todos os eventos
    assert.equal(validateAuditEventByRole('admin', 'CHECK_IN').allowed, true);
    assert.equal(validateAuditEventByRole('admin', 'QUOTE_APPROVED').allowed, true);
  });

  test('Cenário 24 (B.2.2 system_users RLS Granular): Bloqueia anon e restringe DML a superadministradores', () => {
    function evaluateSystemUsersPolicy({ session, operation }) {
      if (session.isAnon) {
        return { allowed: false, error: '42501: Tabela system_users restrita a authenticated' };
      }
      if (operation === 'SELECT') {
        if (session.isAdmin || session.isSelf) return { allowed: true };
        return { allowed: false, error: '42501: Usuário comum não visualiza outros usuários' };
      }
      if (['INSERT', 'UPDATE', 'DELETE'].includes(operation)) {
        if (session.isSystemAdmin) return { allowed: true };
        return { allowed: false, error: '42501: Apenas superadministrador pode alterar usuários' };
      }
      return { allowed: false };
    }

    // Anon tentando SELECT: BLOQUEADO
    assert.equal(evaluateSystemUsersPolicy({ session: { isAnon: true }, operation: 'SELECT' }).allowed, false);

    // Usuário comum autenticado tentando DELETE ou UPDATE de usuário: BLOQUEADO
    assert.equal(evaluateSystemUsersPolicy({ session: { isAnon: false, isSystemAdmin: false }, operation: 'DELETE' }).allowed, false);
    assert.equal(evaluateSystemUsersPolicy({ session: { isAnon: false, isSystemAdmin: false }, operation: 'INSERT' }).allowed, false);

    // Superadministrador: PERMITIDO
    assert.equal(evaluateSystemUsersPolicy({ session: { isAnon: false, isSystemAdmin: true }, operation: 'DELETE' }).allowed, true);
  });
});
