import { useState, useEffect, useCallback } from 'react';
import type {
  Ticket,
  Technician,
  School,
  TicketCategory,
  SystemUser,
  RegionalCoordination
} from '../data/seedData';
import {
  INITIAL_TICKETS,
  TECHNICIANS,
  SCHOOLS,
  TICKET_CATEGORIES,
  REGIONAL_COORDINATIONS,
  INITIAL_SYSTEM_USERS
} from '../data/seedData';
import {
  getBestCandidateTechnician,
  generateTicketProtocol,
  generateTrackingToken,
  calculateDistanceKm
} from './geoEngine';
import type { TicketSubmissionData, QuoteSubmissionData, TicketCompletionData } from './schemas';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import {
  fetchRemoteTickets,
  createRemoteTicket,
  updateRemoteTicketStatus
} from './ticketService';
import {
  fetchRemoteSchools,
  fetchRemoteTechnicians,
  fetchRemoteSystemUsers,
  fetchRemoteCategories,
  fetchRemoteRegions
} from './masterDataService';
import { validateStateTransition } from './stateMachine';

const TICKETS_STORAGE_KEY = 'helptechinfo_tickets_v2';
const TECHNICIANS_STORAGE_KEY = 'helptechinfo_techs_v2';
const USERS_STORAGE_KEY = 'helptechinfo_users_v2';

export function getStoredTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(TICKETS_STORAGE_KEY);
    if (raw) {
      const parsed: Ticket[] = JSON.parse(raw);
      // Remove automaticamente os chamados demo (tkt-001, tkt-002, tkt-003)
      const nonDemo = parsed.filter(
        (t) => !['tkt-001', 'tkt-002', 'tkt-003'].includes(t.id) && !t.protocol?.includes('OS-2026-08412')
      );
      if (nonDemo.length !== parsed.length) {
        localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(nonDemo));
      }
      return nonDemo;
    }
  } catch (err) {
    console.error('Falha ao ler chamados do storage:', err);
  }
  return INITIAL_TICKETS;
}

export function saveStoredTickets(tickets: Ticket[]) {
  try {
    localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
  } catch (err) {
    console.error('Falha ao persistir chamados:', err);
  }
}

export function getStoredTechnicians(): Technician[] {
  try {
    const raw = localStorage.getItem(TECHNICIANS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Falha ao ler técnicos do storage:', err);
  }
  return TECHNICIANS;
}

export function saveStoredTechnicians(techs: Technician[]) {
  try {
    localStorage.setItem(TECHNICIANS_STORAGE_KEY, JSON.stringify(techs));
  } catch (err) {
    console.error('Falha ao persistir técnicos:', err);
  }
}

export function getStoredSystemUsers(): SystemUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Falha ao ler usuários do storage:', err);
  }
  return INITIAL_SYSTEM_USERS;
}

export function saveStoredSystemUsers(users: SystemUser[]) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Falha ao persistir usuários:', err);
  }
}

// Hook principal de gerenciamento do ecossistema de dados com persistência Supabase
export function useAppStore() {
  const [tickets, setTickets] = useState<Ticket[]>(getStoredTickets);
  const [technicians, setTechnicians] = useState<Technician[]>(getStoredTechnicians);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(getStoredSystemUsers);
  const [schools, setSchools] = useState<School[]>(SCHOOLS);
  const [categories, setCategories] = useState<TicketCategory[]>(TICKET_CATEGORIES);
  const [regions, setRegions] = useState<RegionalCoordination[]>(REGIONAL_COORDINATIONS);

  const [remoteStatus, setRemoteStatus] = useState<'conectado' | 'offline_fallback'>(
    isSupabaseConfigured ? 'conectado' : 'offline_fallback'
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Sincronização inicial com o Supabase
  const refreshData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    setIsSyncing(true);
    try {
      const [remoteTkts, remoteSchs, remoteTechs, remoteUsers, remoteCats, remoteRegs] =
        await Promise.all([
          fetchRemoteTickets(),
          fetchRemoteSchools(),
          fetchRemoteTechnicians(),
          fetchRemoteSystemUsers(),
          fetchRemoteCategories(),
          fetchRemoteRegions()
        ]);

      if (remoteTkts.data && remoteTkts.data.length > 0) {
        setTickets(remoteTkts.data);
        saveStoredTickets(remoteTkts.data);
      }
      if (remoteSchs.data && !remoteSchs.fromFallback) {
        setSchools(remoteSchs.data);
      }
      if (remoteTechs.data && !remoteTechs.fromFallback) {
        setTechnicians(remoteTechs.data);
        saveStoredTechnicians(remoteTechs.data);
      }
      if (remoteUsers.data && !remoteUsers.fromFallback) {
        setSystemUsers(remoteUsers.data);
        saveStoredSystemUsers(remoteUsers.data);
      }
      if (remoteCats.data && !remoteCats.fromFallback) {
        setCategories(remoteCats.data);
      }
      if (remoteRegs.data && !remoteRegs.fromFallback) {
        setRegions(remoteRegs.data);
      }

      setRemoteStatus('conectado');
    } catch (err) {
      console.warn('Sincronização com Supabase em modo fallback local:', err);
      setRemoteStatus('offline_fallback');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Sincronização em tempo real via Supabase Realtime (postgres_changes)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    try {
      const channel = supabase
        .channel('public-db-realtime-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tickets' },
          () => {
            refreshData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ticket_quotes' },
          () => {
            refreshData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'technicians' },
          () => {
            refreshData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Falha ao registrar canal de sincronização Realtime:', err);
    }
  }, [refreshData]);

  // Persistência local imediata para cache / offline
  useEffect(() => {
    saveStoredTickets(tickets);
  }, [tickets]);

  useEffect(() => {
    saveStoredTechnicians(technicians);
  }, [technicians]);

  useEffect(() => {
    saveStoredSystemUsers(systemUsers);
  }, [systemUsers]);

  // Checa periodicamente se há chamados despachados cujo timeout de 20 min expirou
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      let hasChanges = false;

      const updated = tickets.map((t) => {
        if (
          t.status === 'despachado' &&
          t.dispatch_timeout_at &&
          new Date(t.dispatch_timeout_at).getTime() <= now
        ) {
          hasChanges = true;
          const previousTechId = t.assigned_technician_id;
          const previousTech = technicians.find((tech) => tech.id === previousTechId);
          const excludedIds = [
            ...t.dispatch_logs.map((l) => l.technician_id),
            ...(previousTechId ? [previousTechId] : [])
          ];

          const school = schools.find((s) => s.id === t.school_id);
          const nextCandidate = school
            ? getBestCandidateTechnician(
                school.latitude,
                school.longitude,
                technicians,
                tickets,
                excludedIds
              )
            : null;

          const newLogs = [
            ...t.dispatch_logs,
            {
              id: `log-timeout-${Date.now()}`,
              ticket_id: t.id,
              technician_id: previousTechId || 'unknown',
              technician_name: previousTech?.name || 'Técnico anterior',
              status: 'timeout' as const,
              refusal_reason: 'Tempo limite de 20 minutos esgotado sem aceite do técnico.',
              created_at: new Date().toISOString()
            }
          ];

          if (nextCandidate) {
            newLogs.push({
              id: `log-redisp-${Date.now()}`,
              ticket_id: t.id,
              technician_id: nextCandidate.technician.id,
              technician_name: nextCandidate.technician.name,
              status: 'notificado' as const,
              created_at: new Date().toISOString()
            });

            // Atualiza remotamente no Supabase
            updateRemoteTicketStatus(
              t.id,
              'despachado',
              {
                assigned_technician_id: nextCandidate.technician.id,
                dispatch_attempts: t.dispatch_attempts + 1,
                dispatch_timeout_at: new Date(Date.now() + 20 * 60 * 1000).toISOString()
              },
              { name: 'Motor de Despacho Automático', role: 'sistema' },
              'despachado'
            );

            return {
              ...t,
              status: 'despachado' as const,
              assigned_technician_id: nextCandidate.technician.id,
              assigned_technician_name: nextCandidate.technician.name,
              dispatch_attempts: t.dispatch_attempts + 1,
              dispatch_timeout_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
              dispatch_logs: newLogs
            };
          } else {
            // Nenhum técnico elegível disponível: vai para fila de exceção para a Central
            updateRemoteTicketStatus(
              t.id,
              'aberto',
              { assigned_technician_id: undefined, dispatch_timeout_at: undefined },
              { name: 'Motor de Despacho Automático', role: 'sistema' },
              'despachado'
            );

            return {
              ...t,
              status: 'aberto' as const,
              assigned_technician_id: undefined,
              assigned_technician_name: undefined,
              dispatch_timeout_at: undefined,
              updated_at: new Date().toISOString(),
              dispatch_logs: newLogs
            };
          }
        }
        return t;
      });

      if (hasChanges) {
        setTickets(updated);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [tickets, technicians, schools]);

  /**
   * 1. Abertura guiada de chamado pelo Gestor Escolar
   */
  const createTicket = (
    data: TicketSubmissionData,
    attachmentsData: { file_url: string; file_name: string; file_size_bytes: number }[]
  ): Ticket => {
    const school = schools.find((s) => s.id === data.school_id);
    const category = categories.find((c) => c.id === data.category_id);
    const protocol = generateTicketProtocol(tickets.map((t) => t.protocol));
    const trackingToken = generateTrackingToken();
    const ticketId = `tkt-${Date.now()}`;

    // Executa Motor de Proximidade Geográfica
    const candidate = school
      ? getBestCandidateTechnician(
          school.latitude,
          school.longitude,
          technicians,
          tickets,
          []
        )
      : null;

    const initialAttachments = attachmentsData.map((att, idx) => ({
      id: `att-${ticketId}-${idx}`,
      ticket_id: ticketId,
      phase: 'abertura' as const,
      file_url: att.file_url,
      file_name: att.file_name,
      file_size_bytes: att.file_size_bytes,
      created_at: new Date().toISOString()
    }));

    const initialLogs = candidate
      ? [
          {
            id: `log-${Date.now()}`,
            ticket_id: ticketId,
            technician_id: candidate.technician.id,
            technician_name: candidate.technician.name,
            status: 'notificado' as const,
            created_at: new Date().toISOString()
          }
        ]
      : [];

    const initialNotifications = [
      {
        id: `notif-user-${ticketId}`,
        ticket_id: ticketId,
        type: 'abertura' as const,
        recipient_role: 'escola' as const,
        recipient_phone_or_email: data.requester_phone,
        channel: 'whatsapp' as const,
        title: 'Confirmação de Abertura de Chamado',
        message: `Olá ${data.requester_name}! Seu chamado HelpTech ${protocol} foi registrado com sucesso para ${school?.name || 'sua escola'}. Categoria: ${category?.name}. Você pode acompanhar em tempo real pelo portal.`,
        sent_at: new Date().toISOString()
      },
      ...(candidate
        ? [
            {
              id: `notif-tech-${ticketId}`,
              ticket_id: ticketId,
              type: 'despacho' as const,
              recipient_role: 'tecnico' as const,
              recipient_phone_or_email: candidate.technician.phone,
              channel: 'push' as const,
              title: 'Chamado Atribuído por Proximidade',
              message: `Novo chamado ${protocol} em ${school?.name} (${candidate.distanceKm.toFixed(1)} km de distância). Prazo de aceite: 20 min.`,
              sent_at: new Date().toISOString()
            }
          ]
        : [])
    ];

    const newTicket: Ticket = {
      id: ticketId,
      protocol,
      tracking_token: trackingToken,
      school_id: data.school_id,
      school_name: school?.name || 'Escola Não Identificada',
      cre_name: school?.cre_name || 'CRE Geral',
      school_address: school?.address || 'Brasília, DF',
      category_id: data.category_id,
      category_name: category?.name || 'Geral',
      requester_name: data.requester_name,
      requester_role: data.requester_role,
      requester_phone: data.requester_phone,
      title: data.title,
      description: data.description,
      equipment_patrimony: data.equipment_patrimony || undefined,
      urgency_level: data.urgency_level,
      status: candidate ? 'despachado' : 'aberto',
      assigned_technician_id: candidate?.technician.id,
      assigned_technician_name: candidate?.technician.name,
      dispatch_attempts: candidate ? 1 : 0,
      dispatch_timeout_at: candidate
        ? new Date(Date.now() + 20 * 60 * 1000).toISOString()
        : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attachments: initialAttachments,
      dispatch_logs: initialLogs,
      notifications: initialNotifications
    };

    setTickets((prev) => [newTicket, ...prev]);

    // Gravação assíncrona remota no Supabase
    createRemoteTicket(newTicket, {
      name: data.requester_name,
      role: `ROLE_SCHOOL (${data.requester_role})`
    }).then((res) => {
      if (res.data && res.data.id !== newTicket.id) {
        // Atualiza com o UUID remoto gerado pelo banco
        setTickets((curr) => curr.map((t) => (t.id === newTicket.id ? { ...t, id: res.data!.id } : t)));
      }
    });

    return newTicket;
  };

  /**
   * 2. PWA Técnico: Aceitar chamado
   */
  const acceptTicket = (ticketId: string, technicianId: string) => {
    const target = tickets.find((t) => t.id === ticketId);
    if (!target) return;

    const transitionVal = validateStateTransition(target.status, 'em_deslocamento');
    if (!transitionVal.valid) {
      console.warn('Transição rejeitada:', transitionVal.error);
      return;
    }

    const tech = technicians.find((tc) => tc.id === technicianId);
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'em_deslocamento',
            dispatch_timeout_at: undefined,
            updated_at: new Date().toISOString(),
            dispatch_logs: [
              ...t.dispatch_logs,
              {
                id: `log-acc-${Date.now()}`,
                ticket_id: t.id,
                technician_id: technicianId,
                technician_name: tech?.name || 'Técnico',
                status: 'aceito',
                created_at: new Date().toISOString()
              }
            ]
          };
        }
        return t;
      })
    );

    updateRemoteTicketStatus(
      ticketId,
      'em_deslocamento',
      { dispatch_timeout_at: undefined },
      { name: tech?.name || 'Técnico de Campo', role: 'ROLE_TECH' },
      'despachado'
    );
  };

  /**
   * 3. PWA Técnico: Recusar chamado com justificativa e acionar re-despacho
   */
  const refuseTicket = (ticketId: string, technicianId: string, reason: string) => {
    const tech = technicians.find((tc) => tc.id === technicianId);
    const target = tickets.find((t) => t.id === ticketId);
    if (!target) return;

    const excludedIds = [
      ...target.dispatch_logs.map((l) => l.technician_id),
      technicianId
    ];

    const school = schools.find((s) => s.id === target.school_id);
    const nextCandidate = school
      ? getBestCandidateTechnician(school.latitude, school.longitude, technicians, tickets, excludedIds)
      : null;

    const nextStatus = nextCandidate ? 'despachado' : 'aberto';
    const transitionVal = validateStateTransition(target.status, nextStatus, { refusalReason: reason });
    if (!transitionVal.valid) {
      console.warn('Recusa rejeitada pela máquina de estados:', transitionVal.error);
      return;
    }

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          const updatedLogs = [
            ...t.dispatch_logs,
            {
              id: `log-ref-${Date.now()}`,
              ticket_id: t.id,
              technician_id: technicianId,
              technician_name: tech?.name || 'Técnico',
              status: 'recusado' as const,
              refusal_reason: reason,
              created_at: new Date().toISOString()
            }
          ];

          if (nextCandidate) {
            updatedLogs.push({
              id: `log-redisp-${Date.now()}`,
              ticket_id: t.id,
              technician_id: nextCandidate.technician.id,
              technician_name: nextCandidate.technician.name,
              status: 'notificado' as const,
              created_at: new Date().toISOString()
            });

            return {
              ...t,
              status: 'despachado' as const,
              assigned_technician_id: nextCandidate.technician.id,
              assigned_technician_name: nextCandidate.technician.name,
              dispatch_attempts: t.dispatch_attempts + 1,
              dispatch_timeout_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
              dispatch_logs: updatedLogs
            };
          } else {
            return {
              ...t,
              status: 'aberto' as const,
              assigned_technician_id: undefined,
              assigned_technician_name: undefined,
              dispatch_timeout_at: undefined,
              updated_at: new Date().toISOString(),
              dispatch_logs: updatedLogs
            };
          }
        }
        return t;
      })
    );

    updateRemoteTicketStatus(
      ticketId,
      nextStatus,
      {
        assigned_technician_id: nextCandidate?.technician.id || undefined,
        dispatch_attempts: (target?.dispatch_attempts || 0) + 1,
        dispatch_timeout_at: nextCandidate ? new Date(Date.now() + 20 * 60 * 1000).toISOString() : undefined
      },
      { name: tech?.name || 'Técnico', role: 'ROLE_TECH' },
      'despachado'
    );
  };

  /**
   * 4. PWA Técnico: Check-in por Geofencing no Colégio
   */
  const checkInTechnician = (
    ticketId: string,
    technicianId: string,
    currentLat: number,
    currentLng: number
  ): { success: boolean; distanceKm: number; message: string } => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) {
      return { success: false, distanceKm: 0, message: 'Chamado não encontrado.' };
    }

    const school = schools.find((s) => s.id === ticket.school_id);
    if (!school) {
      return { success: false, distanceKm: 0, message: 'Escola não localizada.' };
    }

    const transitionVal = validateStateTransition(ticket.status, 'em_atendimento', {
      arrivalCoordinates: { lat: currentLat, lng: currentLng }
    });
    if (!transitionVal.valid) {
      return { success: false, distanceKm: 0, message: transitionVal.error || 'Check-in inválido.' };
    }

    const tech = technicians.find((tc) => tc.id === technicianId);

    const distance = calculateDistanceKm(
      currentLat,
      currentLng,
      school.latitude,
      school.longitude
    );

    const withinRadius = distance <= 1.5;

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'em_atendimento',
            arrival_lat: currentLat,
            arrival_lng: currentLng,
            arrived_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
        return t;
      })
    );

    updateRemoteTicketStatus(
      ticketId,
      'em_atendimento',
      {
        arrival_lat: currentLat,
        arrival_lng: currentLng,
        arrived_at: new Date().toISOString()
      },
      { name: tech?.name || ticket.assigned_technician_name || 'Técnico', role: 'ROLE_TECH' },
      ticket.status
    );

    return {
      success: true,
      distanceKm: distance,
      message: withinRadius
        ? `Check-in validado com sucesso! Você está a ${distance} km da escola.`
        : `Check-in registrado (aviso de distância: ${distance} km). Em atendimento.`
    };
  };

  /**
   * 5. PWA Técnico: Lançar Orçamento de Peças/Serviços
   */
  const submitQuote = (
    ticketId: string,
    technicianId: string,
    data: QuoteSubmissionData
  ) => {
    const target = tickets.find((t) => t.id === ticketId);
    if (!target) return;

    const transitionVal = validateStateTransition(target.status, 'aguardando_orcamento', { quoteData: data });
    if (!transitionVal.valid) {
      console.warn('Orçamento rejeitado pela máquina de estados:', transitionVal.error);
      return;
    }

    const tech = technicians.find((t) => t.id === technicianId);
    const quoteId = `qt-${Date.now()}`;

    const items = data.items.map((item, idx) => ({
      id: `qi-${quoteId}-${idx}`,
      quote_id: quoteId,
      item_type: item.item_type,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: Math.round(item.quantity * item.unit_price * 100) / 100
    }));

    const totalAmount = items.reduce((acc, curr) => acc + curr.subtotal, 0);

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'aguardando_orcamento',
            updated_at: new Date().toISOString(),
            quote: {
              id: quoteId,
              ticket_id: ticketId,
              technician_id: technicianId,
              technician_name: tech?.name || 'Técnico Credenciado',
              total_amount: Math.round(totalAmount * 100) / 100,
              technical_diagnosis: data.technical_diagnosis,
              status: 'pendente',
              created_at: new Date().toISOString(),
              items
            }
          };
        }
        return t;
      })
    );

    updateRemoteTicketStatus(
      ticketId,
      'aguardando_orcamento',
      {},
      { name: tech?.name || 'Técnico', role: 'ROLE_TECH' },
      'em_atendimento'
    );
  };

  /**
   * 6. Gestor Escolar / Central: Aprovar ou Rejeitar Orçamento
   */
  const decideQuote = (
    ticketId: string,
    approved: boolean,
    decisionByName: string,
    reason?: string
  ) => {
    const target = tickets.find((t) => t.id === ticketId);
    if (!target) return;

    const nextStatus = approved ? 'aguardando_peca' : 'cancelado';
    const transitionVal = validateStateTransition(target.status, nextStatus, {
      quoteDecision: { approved, reason },
      cancelReason: reason
    });
    if (!transitionVal.valid) {
      console.warn('Decisão de orçamento rejeitada pela máquina de estados:', transitionVal.error);
      return;
    }

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId && t.quote) {
          return {
            ...t,
            status: nextStatus,
            updated_at: new Date().toISOString(),
            quote: {
              ...t.quote,
              status: approved ? 'aprovado' : 'rejeitado',
              decision_by_name: decisionByName,
              decision_reason: reason,
              decided_at: new Date().toISOString()
            }
          };
        }
        return t;
      })
    );

    updateRemoteTicketStatus(
      ticketId,
      nextStatus,
      {},
      { name: decisionByName, role: 'GESTOR_OU_CENTRAL' },
      'aguardando_orcamento'
    );
  };

  /**
   * 7. Conclusão do Chamado com Coleta da Assinatura Digital do Diretor
   */
  const completeTicket = (
    ticketId: string,
    technicianId: string,
    data: TicketCompletionData
  ) => {
    const target = tickets.find((t) => t.id === ticketId);
    if (!target) return;

    const transitionVal = validateStateTransition(target.status, 'concluido', { completionData: data });
    if (!transitionVal.valid) {
      console.warn('Conclusão rejeitada pela máquina de estados:', transitionVal.error);
      return;
    }

    const tech = technicians.find((t) => t.id === technicianId);
    const completionId = `cmp-${Date.now()}`;

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'concluido',
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            completion: {
              id: completionId,
              ticket_id: ticketId,
              technician_id: technicianId,
              technician_name: tech?.name || 'Técnico Responsável',
              service_summary: data.service_summary,
              school_representative_name: data.school_representative_name,
              school_representative_doc: data.school_representative_doc,
              signature_svg: data.signature_svg,
              completed_at: new Date().toISOString()
            }
          };
        }
        return t;
      })
    );

    updateRemoteTicketStatus(
      ticketId,
      'concluido',
      { resolved_at: new Date().toISOString() },
      { name: tech?.name || 'Técnico', role: 'ROLE_TECH' },
      'em_atendimento'
    );
  };

  /**
   * 8. PWA Técnico: Agendar visita presencial com o gestor
   */
  const scheduleVisit = (ticketId: string, scheduledAt: string, notes: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          const notif = {
            id: `notif-visit-${Date.now()}`,
            ticket_id: t.id,
            type: 'visita' as const,
            recipient_role: 'escola' as const,
            recipient_phone_or_email: t.requester_phone,
            channel: 'whatsapp' as const,
            title: 'Visita Técnica Agendada',
            message: `Olá ${t.requester_name}! O técnico HelpTech agendou a visita técnica para ${new Date(scheduledAt).toLocaleString('pt-BR')}. Obs: ${notes || 'Sem observações adicionais.'}`,
            sent_at: new Date().toISOString()
          };
          return {
            ...t,
            status: 'visita_agendada' as const,
            scheduled_visit_at: scheduledAt,
            scheduled_visit_notes: notes,
            updated_at: new Date().toISOString(),
            notifications: [...(t.notifications || []), notif],
            dispatch_logs: [
              ...t.dispatch_logs,
              {
                id: `log-visit-${Date.now()}`,
                ticket_id: t.id,
                technician_id: t.assigned_technician_id || 'unknown',
                technician_name: t.assigned_technician_name || 'Técnico',
                status: 'notificado' as const,
                refusal_reason: `Visita agendada para ${new Date(scheduledAt).toLocaleString('pt-BR')}`,
                created_at: new Date().toISOString()
              }
            ]
          };
        }
        return t;
      })
    );

    updateRemoteTicketStatus(
      ticketId,
      'visita_agendada',
      { scheduled_visit_at: scheduledAt, scheduled_visit_notes: notes },
      { name: 'Técnico de Campo', role: 'ROLE_TECH' }
    );
  };

  /**
   * 9. PWA Técnico: Sinalizar Aguardando Peça com notificação
   */
  const setWaitingParts = (ticketId: string, partNotes: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          const notif = {
            id: `notif-part-${Date.now()}`,
            ticket_id: t.id,
            type: 'peca' as const,
            recipient_role: 'escola' as const,
            recipient_phone_or_email: t.requester_phone,
            channel: 'whatsapp' as const,
            title: 'Chamado em Espera de Peça de Reposição',
            message: `Chamado ${t.protocol}: o atendimento foi pausado aguardando envio do componente: ${partNotes}. A Central HelpTech já acionou o estoque.`,
            sent_at: new Date().toISOString()
          };
          return {
            ...t,
            status: 'aguardando_peca' as const,
            pending_part_notes: partNotes,
            updated_at: new Date().toISOString(),
            notifications: [...(t.notifications || []), notif]
          };
        }
        return t;
      })
    );

    updateRemoteTicketStatus(
      ticketId,
      'aguardando_peca',
      { pending_part_notes: partNotes },
      { name: 'Técnico de Campo', role: 'ROLE_TECH' }
    );
  };

  /**
   * 10. PWA Técnico / Central: Sinalizar Aguardando Serviço de Terceiros
   */
  const setWaitingThirdParty = (ticketId: string, thirdPartyNotes: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          const notif = {
            id: `notif-third-${Date.now()}`,
            ticket_id: t.id,
            type: 'terceiro' as const,
            recipient_role: 'escola' as const,
            recipient_phone_or_email: t.requester_phone,
            channel: 'whatsapp' as const,
            title: 'Aguardando Atuação de Terceiros',
            message: `Chamado ${t.protocol}: identificada dependência de concessionária/terceiro: ${thirdPartyNotes}. Acompanhamento aberto com o provedor.`,
            sent_at: new Date().toISOString()
          };
          return {
            ...t,
            status: 'aguardando_terceiro' as const,
            third_party_notes: thirdPartyNotes,
            updated_at: new Date().toISOString(),
            notifications: [...(t.notifications || []), notif]
          };
        }
        return t;
      })
    );

    updateRemoteTicketStatus(
      ticketId,
      'aguardando_terceiro',
      { third_party_notes: thirdPartyNotes },
      { name: 'Técnico / Central', role: 'ROLE_TECH' }
    );
  };

  /**
   * 11. Retomar atendimento
   */
  const resumeService = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'em_atendimento' as const,
            updated_at: new Date().toISOString()
          };
        }
        return t;
      })
    );

    updateRemoteTicketStatus(
      ticketId,
      'em_atendimento',
      {},
      { name: 'Técnico de Campo', role: 'ROLE_TECH' }
    );
  };

  /**
   * 12. Central de Controle: Despacho manual direto
   */
  const manualDispatch = (ticketId: string, technicianId: string) => {
    const tech = technicians.find((t) => t.id === technicianId);
    if (!tech) return;

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          const notif = {
            id: `notif-dispatch-${Date.now()}`,
            ticket_id: t.id,
            type: 'despacho' as const,
            recipient_role: 'tecnico' as const,
            recipient_phone_or_email: tech.phone,
            channel: 'push' as const,
            title: 'Novo Chamado Despachado para Você',
            message: `Novo chamado ${t.protocol} da escola ${t.school_name} foi atribuído a você. Aceite em até 20 minutos no PWA.`,
            sent_at: new Date().toISOString()
          };
          return {
            ...t,
            status: 'despachado' as const,
            assigned_technician_id: tech.id,
            assigned_technician_name: tech.name,
            dispatch_attempts: t.dispatch_attempts + 1,
            dispatch_timeout_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
            notifications: [...(t.notifications || []), notif],
            dispatch_logs: [
              ...t.dispatch_logs,
              {
                id: `log-man-${Date.now()}`,
                ticket_id: t.id,
                technician_id: tech.id,
                technician_name: tech.name,
                status: 'notificado' as const,
                created_at: new Date().toISOString()
              }
            ]
          };
        }
        return t;
      })
    );

    updateRemoteTicketStatus(
      ticketId,
      'despachado',
      {
        assigned_technician_id: tech.id,
        dispatch_attempts: 1,
        dispatch_timeout_at: new Date(Date.now() + 20 * 60 * 1000).toISOString()
      },
      { name: 'Operador da Central', role: 'ROLE_ADMIN' }
    );
  };

  /**
   * 13. CRUD de Técnicos de Campo
   */
  const createTechnician = (techData: Omit<Technician, 'id'>) => {
    const newTech: Technician = {
      ...techData,
      id: `tech-${Date.now().toString(36)}`
    };
    setTechnicians((prev) => [newTech, ...prev]);
    return newTech;
  };

  const updateTechnician = (id: string, updates: Partial<Technician>) => {
    setTechnicians((prev) =>
      prev.map((tech) => (tech.id === id ? { ...tech, ...updates } : tech))
    );
  };

  const deleteTechnician = (id: string) => {
    setTechnicians((prev) => prev.filter((tech) => tech.id !== id));
  };

  const toggleTechnicianStatus = (id: string) => {
    setTechnicians((prev) =>
      prev.map((tech) => {
        if (tech.id === id) {
          const nextStatus = tech.status === 'disponivel' ? 'indisponivel' : 'disponivel';
          return { ...tech, status: nextStatus };
        }
        return tech;
      })
    );
  };

  /**
   * 14. CRUD de Administradores / Usuários do Sistema
   */
  const createSystemUser = (userData: Omit<SystemUser, 'id' | 'created_at'>) => {
    const newUser: SystemUser = {
      ...userData,
      id: `usr-${Date.now().toString(36)}`,
      created_at: new Date().toISOString()
    };
    setSystemUsers((prev) => [newUser, ...prev]);
    return newUser;
  };

  const updateSystemUser = (id: string, updates: Partial<SystemUser>) => {
    setSystemUsers((prev) =>
      prev.map((usr) => (usr.id === id ? { ...usr, ...updates } : usr))
    );
  };

  const deleteSystemUser = (id: string) => {
    setSystemUsers((prev) => prev.filter((usr) => usr.id !== id));
  };

  const toggleSystemUserActive = (id: string) => {
    setSystemUsers((prev) =>
      prev.map((usr) => {
        if (usr.id === id) {
          return { ...usr, active: !usr.active };
        }
        return usr;
      })
    );
  };

  /**
   * Restaura o banco de dados local para o estado padrão
   */
  const resetDatabase = () => {
    setTickets(INITIAL_TICKETS);
    setTechnicians(TECHNICIANS);
    setSystemUsers(INITIAL_SYSTEM_USERS);
    saveStoredTickets(INITIAL_TICKETS);
    saveStoredTechnicians(TECHNICIANS);
    saveStoredSystemUsers(INITIAL_SYSTEM_USERS);
  };

  return {
    tickets,
    technicians,
    systemUsers,
    schools,
    categories,
    regions,
    remoteStatus,
    isSyncing,
    refreshData,
    createTicket,
    acceptTicket,
    refuseTicket,
    checkInTechnician,
    submitQuote,
    decideQuote,
    completeTicket,
    scheduleVisit,
    setWaitingParts,
    setWaitingThirdParty,
    resumeService,
    manualDispatch,
    createTechnician,
    updateTechnician,
    deleteTechnician,
    toggleTechnicianStatus,
    createSystemUser,
    updateSystemUser,
    deleteSystemUser,
    toggleSystemUserActive,
    resetDatabase
  };
}
