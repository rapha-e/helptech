import { useState, useEffect } from 'react';
import type {
  Ticket,
  Technician,
  School,
  TicketCategory
} from '../data/seedData';
import {
  INITIAL_TICKETS,
  TECHNICIANS,
  SCHOOLS,
  TICKET_CATEGORIES,
  REGIONAL_COORDINATIONS
} from '../data/seedData';
import {
  getBestCandidateTechnician,
  generateTicketProtocol,
  generateTrackingToken,
  calculateDistanceKm
} from './geoEngine';
import type { TicketSubmissionData, QuoteSubmissionData, TicketCompletionData } from './schemas';

const TICKETS_STORAGE_KEY = 'helptechinfo_tickets_v2';
const TECHNICIANS_STORAGE_KEY = 'helptechinfo_techs_v2';

export function getStoredTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(TICKETS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
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

// Hook principal de gerenciamento do ecossistema de dados
export function useAppStore() {
  const [tickets, setTickets] = useState<Ticket[]>(getStoredTickets);
  const [technicians, setTechnicians] = useState<Technician[]>(getStoredTechnicians);
  const [schools] = useState<School[]>(SCHOOLS);
  const [categories] = useState<TicketCategory[]>(TICKET_CATEGORIES);
  const [regions] = useState(REGIONAL_COORDINATIONS);

  useEffect(() => {
    saveStoredTickets(tickets);
  }, [tickets]);

  useEffect(() => {
    saveStoredTechnicians(technicians);
  }, [technicians]);

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
          // Registra log de timeout para o técnico anterior
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
    }, 10000); // Checagem a cada 10 segundos

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
    const protocol = generateTicketProtocol();
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
      dispatch_logs: initialLogs
    };

    setTickets((prev) => [newTicket, ...prev]);
    return newTicket;
  };

  /**
   * 2. PWA Técnico: Aceitar chamado
   */
  const acceptTicket = (ticketId: string, technicianId: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          const tech = technicians.find((tc) => tc.id === technicianId);
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
  };

  /**
   * 3. PWA Técnico: Recusar chamado com justificativa e acionar re-despacho
   */
  const refuseTicket = (ticketId: string, technicianId: string, reason: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          const tech = technicians.find((tc) => tc.id === technicianId);
          const excludedIds = [
            ...t.dispatch_logs.map((l) => l.technician_id),
            technicianId
          ];

          const school = schools.find((s) => s.id === t.school_id);
          const nextCandidate = school
            ? getBestCandidateTechnician(
                school.latitude,
                school.longitude,
                technicians,
                prev,
                excludedIds
              )
            : null;

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
              id: `log-next-${Date.now()}`,
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
  };

  /**
   * 4. PWA Técnico: Check-in presencial com validação de raio GPS
   */
  const checkInTechnician = (
    ticketId: string,
    _technicianId: string,
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

    const distance = calculateDistanceKm(
      currentLat,
      currentLng,
      school.latitude,
      school.longitude
    );

    // Permite check-in em raio de até 1.5 km do colégio (tolerância de GPS)
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
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId && t.quote) {
          const nextStatus = approved ? 'aguardando_peca' : 'cancelado';
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
  };

  /**
   * 7. Conclusão do Chamado com Coleta da Assinatura Digital do Diretor
   */
  const completeTicket = (
    ticketId: string,
    technicianId: string,
    data: TicketCompletionData
  ) => {
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
  };

  /**
   * 8. Central de Controle: Despacho manual direto
   */
  const manualDispatch = (ticketId: string, technicianId: string) => {
    const tech = technicians.find((t) => t.id === technicianId);
    if (!tech) return;

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'despachado',
            assigned_technician_id: tech.id,
            assigned_technician_name: tech.name,
            dispatch_attempts: t.dispatch_attempts + 1,
            dispatch_timeout_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
            dispatch_logs: [
              ...t.dispatch_logs,
              {
                id: `log-man-${Date.now()}`,
                ticket_id: t.id,
                technician_id: tech.id,
                technician_name: tech.name,
                status: 'notificado',
                created_at: new Date().toISOString()
              }
            ]
          };
        }
        return t;
      })
    );
  };

  /**
   * Restaura o banco de dados local para o estado padrão
   */
  const resetDatabase = () => {
    setTickets(INITIAL_TICKETS);
    setTechnicians(TECHNICIANS);
    saveStoredTickets(INITIAL_TICKETS);
    saveStoredTechnicians(TECHNICIANS);
  };

  return {
    tickets,
    technicians,
    schools,
    categories,
    regions,
    createTicket,
    acceptTicket,
    refuseTicket,
    checkInTechnician,
    submitQuote,
    decideQuote,
    completeTicket,
    manualDispatch,
    resetDatabase
  };
}
