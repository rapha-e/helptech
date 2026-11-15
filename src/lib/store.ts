import { useState, useEffect, useCallback } from 'react';
import type {
  Ticket,
  Technician,
  School,
  TicketCategory,
  SystemUser,
  RegionalCoordination,
  InventoryItem,
  TicketHistoryEntry
} from '../data/seedData';
import {
  INITIAL_TICKETS,
  TECHNICIANS,
  SCHOOLS,
  TICKET_CATEGORIES,
  REGIONAL_COORDINATIONS,
  INITIAL_SYSTEM_USERS,
  INITIAL_INVENTORY
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
  updateRemoteTicketStatus,
  adminUpdateTicketRemote,
  completeTicketRemote,
  submitQuoteRemote,
  decideQuoteRemote,
  acceptDispatchRemote,
  refuseDispatchRemote,
  checkInRemote
} from './ticketService';
import {
  fetchRemoteSchools,
  fetchRemoteTechnicians,
  fetchRemoteSystemUsers,
  fetchRemoteCategories,
  fetchRemoteRegions,
  saveRemoteTechnicianWithAuth,
  saveRemoteSystemUserWithAuth
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

const INVENTORY_STORAGE_KEY = 'helptechinfo_inventory_v2';

export function getStoredInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Falha ao ler inventário do storage:', err);
  }
  return INITIAL_INVENTORY;
}

export function saveStoredInventory(items: InventoryItem[]) {
  try {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Falha ao persistir inventário:', err);
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
  const [inventory, setInventory] = useState<InventoryItem[]>(getStoredInventory);

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
        setTickets((prevLocal) => {
          const localMap = new Map(prevLocal.map((t) => [t.id, t]));
          const merged = remoteTkts.data!.map((remoteT) => {
            const localT = localMap.get(remoteT.id);
            if (!localT) return remoteT;
            const remoteHist = remoteT.history || [];
            const localHist = localT.history || [];
            const combinedHist = [
              ...localHist,
              ...remoteHist.filter((rh) => !localHist.some((lh) => lh.id === rh.id))
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            const remoteTime = new Date(remoteT.updated_at || 0).getTime();
            const localTime = new Date(localT.updated_at || 0).getTime();
            const isLocalNewer = localTime > remoteTime;

            // Se o chamado remoto não está cancelado mas o cache local antigo estava cancelado sem justificativa de orçamento, prioriza o remoto
            const resolvedStatus =
              localT.status === 'cancelado' && remoteT.status !== 'cancelado' && !localT.quote?.decision_reason
                ? remoteT.status
                : isLocalNewer
                ? localT.status
                : remoteT.status;

            // Preserva orçamento já decidido (aprovado/rejeitado) sobre eventual registro pendente antigo
            const resolvedQuote =
              localT.quote && localT.quote.status !== 'pendente'
                ? localT.quote
                : remoteT.quote && remoteT.quote.status !== 'pendente'
                ? remoteT.quote
                : isLocalNewer
                ? localT.quote || remoteT.quote
                : remoteT.quote || localT.quote;

            // Se o cache local estiver mais avançado que o banco remoto (ex.: técnico avançou etapas no PWA), sincroniza automaticamente para o servidor
            if (
              isLocalNewer &&
              (localT.status !== remoteT.status ||
                Boolean(localT.quote) !== Boolean(remoteT.quote) ||
                localT.quote?.status !== remoteT.quote?.status)
            ) {
              (async () => {
                try {
                  if (localT.arrived_at && !remoteT.arrived_at) {
                    await checkInRemote(localT.id, localT.arrival_lat, localT.arrival_lng);
                  }
                  if (localT.quote && (!remoteT.quote || localT.quote.total_amount !== remoteT.quote.total_amount)) {
                    await submitQuoteRemote(
                      localT.id,
                      localT.quote.technician_id || localT.assigned_technician_id || '',
                      localT.quote.technical_diagnosis,
                      localT.quote.items
                    );
                  }
                  if (localT.quote && localT.quote.status !== 'pendente' && remoteT.quote?.status !== localT.quote.status) {
                    await decideQuoteRemote(
                      localT.id,
                      localT.quote.status === 'aprovado',
                      localT.quote.decision_by_name || 'Cliente / Gestão',
                      localT.quote.decision_reason
                    );
                  }
                  if (localT.status !== remoteT.status) {
                    await updateRemoteTicketStatus(
                      localT.id,
                      localT.status,
                      {
                        assigned_technician_id: localT.assigned_technician_id,
                        arrived_at: localT.arrived_at,
                        scheduled_visit_at: localT.scheduled_visit_at
                      },
                      { name: localT.assigned_technician_name || 'Sincronização Automática', role: 'ROLE_TECH' },
                      remoteT.status
                    );
                  }
                } catch (syncErr) {
                  console.warn('Falha ao ressincronizar avanço local para o servidor:', syncErr);
                }
              })();
            }

            return {
              ...remoteT,
              ...(isLocalNewer ? localT : {}),
              status: resolvedStatus,
              assigned_technician_id: isLocalNewer
                ? localT.assigned_technician_id ?? remoteT.assigned_technician_id
                : remoteT.assigned_technician_id ?? localT.assigned_technician_id,
              assigned_technician_name: isLocalNewer
                ? localT.assigned_technician_name ?? remoteT.assigned_technician_name
                : remoteT.assigned_technician_name ?? localT.assigned_technician_name,
              arrived_at: remoteT.arrived_at || localT.arrived_at,
              quote: resolvedQuote,
              completion: remoteT.completion || localT.completion,
              notes: isLocalNewer ? localT.notes || remoteT.notes : remoteT.notes || localT.notes,
              history: combinedHist
            };
          });

          // Preserva chamados criados localmente ainda não sincronizados
          for (const localT of prevLocal) {
            if (!merged.some((m) => m.id === localT.id)) {
              merged.push(localT);
            }
          }

          saveStoredTickets(merged);
          return merged;
        });
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

    // Sincronização instantânea entre abas/janelas do mesmo navegador (ex: Técnico e Controladoria abertos juntos)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TICKETS_STORAGE_KEY && e.newValue) {
        try {
          const parsed: Ticket[] = JSON.parse(e.newValue);
          setTickets(parsed);
        } catch {
          // ignora erro de parse
        }
      }
    };

    const handleWindowFocus = () => {
      setTickets((curr) => {
        const stored = getStoredTickets();
        return stored.length > 0 ? stored : curr;
      });
      refreshData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleWindowFocus);

    const pollInterval = setInterval(() => {
      refreshData();
    }, 6000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(pollInterval);
    };
  }, [refreshData]);

  // Sincronização granular em tempo real (WS4 / F-08: Realtime incremental em memória)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    try {
      const channel = supabase
        .channel('public-db-realtime-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tickets' },
          (payload: any) => {
            const { eventType, new: newRow, old: oldRow } = payload;

            if (eventType === 'UPDATE' && newRow?.id) {
              setTickets((prev) =>
                prev.map((t) => {
                  if (t.id === newRow.id) {
                    return {
                      ...t,
                      status: newRow.status || t.status,
                      assigned_technician_id:
                        newRow.assigned_technician_id !== undefined
                          ? newRow.assigned_technician_id
                          : t.assigned_technician_id,
                      scheduled_visit_at:
                        newRow.scheduled_visit_date || newRow.scheduled_visit_at || t.scheduled_visit_at,
                      scheduled_visit_notes: newRow.scheduled_visit_notes ?? t.scheduled_visit_notes,
                      pending_part_notes: newRow.pending_part_notes ?? t.pending_part_notes,
                      third_party_notes: newRow.third_party_notes ?? t.third_party_notes,
                      arrived_at: newRow.arrived_at || t.arrived_at,
                      resolved_at: newRow.resolved_at || t.resolved_at,
                      updated_at: newRow.updated_at || new Date().toISOString()
                    };
                  }
                  return t;
                })
              );
            } else if (eventType === 'INSERT' && newRow?.id) {
              setTickets((prev) => {
                if (prev.some((t) => t.id === newRow.id || t.protocol === newRow.protocol)) {
                  return prev.map((t) => (t.id === newRow.id ? { ...t, ...newRow } : t));
                }
                const sch = schools.find((s) => s.id === newRow.school_id);
                const cat = categories.find((c) => c.id === newRow.category_id);
                const mappedTicket: Ticket = {
                  id: newRow.id,
                  protocol: newRow.protocol,
                  tracking_token: newRow.tracking_token,
                  school_id: newRow.school_id,
                  school_name: sch?.name || 'Unidade Escolar',
                  school_address: sch?.address || '',
                  cre_name: sch?.cre_name || '',
                  category_id: newRow.category_id,
                  category_name: cat?.name || 'Geral',
                  requester_name: newRow.requester_name,
                  requester_role: newRow.requester_role,
                  requester_phone: newRow.requester_phone,
                  title: newRow.title,
                  description: newRow.description,
                  equipment_patrimony: newRow.equipment_patrimony,
                  urgency_level: newRow.urgency_level,
                  status: newRow.status,
                  assigned_technician_id: newRow.assigned_technician_id,
                  created_at: newRow.created_at,
                  updated_at: newRow.updated_at,
                  dispatch_attempts: newRow.dispatch_attempts || 1,
                  dispatch_logs: [],
                  attachments: []
                };
                return [mappedTicket, ...prev];
              });
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setTickets((prev) => prev.filter((t) => t.id !== oldRow.id));
            } else {
              refreshData();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'technicians' },
          (payload: any) => {
            const { eventType, new: newRow } = payload;
            if (eventType === 'UPDATE' && newRow?.id) {
              setTechnicians((prev) =>
                prev.map((tc) => (tc.id === newRow.id ? { ...tc, ...newRow } : tc))
              );
            } else {
              fetchRemoteTechnicians().then((res) => {
                if (res.data) setTechnicians(res.data);
              });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ticket_quotes' },
          (payload: any) => {
            const { new: newQuote } = payload;
            if (newQuote?.ticket_id) {
              const tech = technicians.find((tc) => tc.id === newQuote.technician_id);
              setTickets((prev) =>
                prev.map((t) => {
                  if (t.id === newQuote.ticket_id) {
                    return {
                      ...t,
                      quote: {
                        id: newQuote.id,
                        ticket_id: newQuote.ticket_id,
                        technician_id: newQuote.technician_id,
                        technician_name: tech?.name || 'Técnico Responsável',
                        total_amount: Number(newQuote.total_amount) || 0,
                        technical_diagnosis: newQuote.justification || newQuote.technical_diagnosis || '',
                        status: (newQuote.status === 'reprovado' ? 'rejeitado' : newQuote.status) as 'pendente' | 'aprovado' | 'rejeitado',
                        created_at: newQuote.created_at,
                        items: (newQuote.parts_list || []).map((p: any, idx: number) => ({
                          id: p.id || `quote-item-${idx}`,
                          quote_id: newQuote.id,
                          item_type: (p.item_type || 'peca') as 'peca' | 'servico',
                          item_name: p.item_name || p.name || 'Peça / Serviço',
                          quantity: Number(p.quantity) || 1,
                          unit_price: Number(p.unit_price) || 0,
                          subtotal: Number(p.subtotal) || (Number(p.quantity) || 1) * (Number(p.unit_price) || 0)
                        }))
                      }
                    };
                  }
                  return t;
                })
              );
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Falha ao registrar canal de sincronização Realtime:', err);
    }
  }, [refreshData, schools, categories, technicians]);

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

  useEffect(() => {
    saveStoredInventory(inventory);
  }, [inventory]);

  // Checa periodicamente timeout de 20 min apenas quando offline / sem Supabase
  // Em produção conectada, o timeout é gerenciado no servidor via pg_cron (F-03 / WS2)
  useEffect(() => {
    if (isSupabaseConfigured) return;

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

    const nowIso = new Date().toISOString();
    const initialHistory: TicketHistoryEntry[] = [
      {
        id: `hist-open-${Date.now()}`,
        created_at: nowIso,
        action_type: 'status_change',
        to_status: candidate ? 'despachado' : 'aberto',
        author_name: data.requester_name,
        author_role: data.requester_role,
        technician_name: candidate?.technician.name,
        note: candidate
          ? `Chamado aberto e despachado automaticamente para ${candidate.technician.name} (${candidate.distanceKm.toFixed(1)} km).`
          : 'Chamado aberto na fila de triagem.'
      }
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
      created_at: nowIso,
      updated_at: nowIso,
      history: initialHistory,
      attachments: initialAttachments,
      dispatch_logs: initialLogs,
      notifications: initialNotifications
    };

    setTickets((prev) => {
      const next = [newTicket, ...prev];
      saveStoredTickets(next);
      return next;
    });

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
    const nowIso = new Date().toISOString();
    const histEntry: TicketHistoryEntry = {
      id: `hist-acc-${Date.now()}`,
      created_at: nowIso,
      action_type: 'status_change',
      from_status: target.status,
      to_status: 'em_deslocamento',
      author_name: tech?.name || 'Técnico de Campo',
      author_role: 'Técnico Credenciado',
      note: 'Chamado aceito pelo técnico. Em deslocamento para a unidade escolar.'
    };

    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'em_deslocamento' as const,
            dispatch_timeout_at: undefined,
            updated_at: nowIso,
            history: [histEntry, ...(t.history || [])],
            dispatch_logs: [
              ...t.dispatch_logs,
              {
                id: `log-acc-${Date.now()}`,
                ticket_id: t.id,
                technician_id: technicianId,
                technician_name: tech?.name || 'Técnico',
                status: 'aceito' as const,
                created_at: nowIso
              }
            ]
          };
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

    acceptDispatchRemote(ticketId).then(() => {
      updateRemoteTicketStatus(
        ticketId,
        'em_deslocamento',
        { dispatch_timeout_at: undefined },
        { name: tech?.name || 'Técnico de Campo', role: 'ROLE_TECH' },
        'despachado'
      );
    });
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

    const nowIso = new Date().toISOString();
    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId) {
          const histEntry: TicketHistoryEntry = {
            id: `hist-ref-${Date.now()}`,
            created_at: nowIso,
            action_type: 'status_change',
            from_status: t.status,
            to_status: nextStatus,
            author_name: tech?.name || 'Técnico de Campo',
            author_role: 'Técnico Credenciado',
            technician_name: nextCandidate?.technician.name,
            note: nextCandidate
              ? `Chamado recusado por ${tech?.name || 'Técnico'} (${reason}). Redespachado para ${nextCandidate.technician.name}.`
              : `Chamado recusado por ${tech?.name || 'Técnico'} (${reason}). Retornado para fila de triagem.`
          };
          const updatedLogs = [
            ...t.dispatch_logs,
            {
              id: `log-ref-${Date.now()}`,
              ticket_id: t.id,
              technician_id: technicianId,
              technician_name: tech?.name || 'Técnico',
              status: 'recusado' as const,
              refusal_reason: reason,
              created_at: nowIso
            }
          ];

          if (nextCandidate) {
            updatedLogs.push({
              id: `log-redisp-${Date.now()}`,
              ticket_id: t.id,
              technician_id: nextCandidate.technician.id,
              technician_name: nextCandidate.technician.name,
              status: 'notificado' as const,
              created_at: nowIso
            });

            return {
              ...t,
              status: 'despachado' as const,
              assigned_technician_id: nextCandidate.technician.id,
              assigned_technician_name: nextCandidate.technician.name,
              dispatch_attempts: t.dispatch_attempts + 1,
              dispatch_timeout_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
              updated_at: nowIso,
              history: [histEntry, ...(t.history || [])],
              dispatch_logs: updatedLogs
            };
          } else {
            return {
              ...t,
              status: 'aberto' as const,
              assigned_technician_id: undefined,
              assigned_technician_name: undefined,
              dispatch_timeout_at: undefined,
              updated_at: nowIso,
              history: [histEntry, ...(t.history || [])],
              dispatch_logs: updatedLogs
            };
          }
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

    refuseDispatchRemote(ticketId, reason).then(() => {
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
    });
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
    const nowIso = new Date().toISOString();
    const histEntry: TicketHistoryEntry = {
      id: `hist-chk-${Date.now()}`,
      created_at: nowIso,
      action_type: 'status_change',
      from_status: ticket.status,
      to_status: 'em_atendimento',
      author_name: tech?.name || ticket.assigned_technician_name || 'Técnico de Campo',
      author_role: 'Técnico Credenciado',
      note: `Check-in presencial realizado via GPS (${distance.toFixed(2)} km da unidade). Atendimento iniciado.`
    };

    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'em_atendimento' as const,
            arrival_lat: currentLat,
            arrival_lng: currentLng,
            arrived_at: nowIso,
            updated_at: nowIso,
            history: [histEntry, ...(t.history || [])]
          };
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

    checkInRemote(ticketId, currentLat, currentLng).then(() => {
      updateRemoteTicketStatus(
        ticketId,
        'em_atendimento',
        {
          arrival_lat: currentLat,
          arrival_lng: currentLng,
          arrived_at: nowIso
        },
        { name: tech?.name || ticket.assigned_technician_name || 'Técnico', role: 'ROLE_TECH' },
        ticket.status
      );
    });

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
      alert(transitionVal.error || 'Dados do orçamento inválidos.');
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
    const nowIso = new Date().toISOString();

    const historyEntry: TicketHistoryEntry = {
      id: `hist-qt-${Date.now()}`,
      created_at: nowIso,
      action_type: 'status_change',
      from_status: target.status,
      to_status: 'aguardando_orcamento',
      author_name: tech?.name || 'Técnico de Campo',
      author_role: 'Técnico Credenciado',
      note: `Orçamento enviado (${totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}): ${data.technical_diagnosis}`
    };

    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'aguardando_orcamento' as const,
            updated_at: nowIso,
            notes: historyEntry.note,
            history: [historyEntry, ...(t.history || [])],
            quote: {
              id: quoteId,
              ticket_id: ticketId,
              technician_id: technicianId,
              technician_name: tech?.name || 'Técnico Credenciado',
              total_amount: Math.round(totalAmount * 100) / 100,
              technical_diagnosis: data.technical_diagnosis,
              status: 'pendente' as const,
              created_at: nowIso,
              items
            }
          };
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

    submitQuoteRemote(ticketId, technicianId, data.technical_diagnosis, items);
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

    const nextStatus = approved ? 'em_atendimento' : 'cancelado';
    const transitionVal = validateStateTransition(target.status, nextStatus, {
      quoteDecision: { approved, reason },
      cancelReason: reason
    });
    if (!transitionVal.valid) {
      console.warn('Decisão de orçamento rejeitada pela máquina de estados:', transitionVal.error);
      return;
    }

    const nowIso = new Date().toISOString();
    const historyEntry: TicketHistoryEntry = {
      id: `hist-dec-${Date.now()}`,
      created_at: nowIso,
      action_type: 'status_change',
      from_status: target.status,
      to_status: nextStatus,
      author_name: decisionByName,
      author_role: 'Cliente / Gestão',
      note: approved
        ? `Orçamento aprovado por ${decisionByName}. Liberado para execução/conclusão.`
        : `Orçamento reprovado por ${decisionByName}: ${reason || 'Sem justificativa adicional.'}`
    };

    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId && t.quote) {
          return {
            ...t,
            status: nextStatus as Ticket['status'],
            updated_at: nowIso,
            notes: historyEntry.note,
            history: [historyEntry, ...(t.history || [])],
            quote: {
              ...t.quote,
              status: (approved ? 'aprovado' : 'rejeitado') as 'aprovado' | 'rejeitado',
              decision_by_name: decisionByName,
              decision_reason: reason,
              decided_at: nowIso
            }
          };
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

    // Baixa automática de peças do estoque WMS quando orçamento é aprovado
    if (approved && target.quote?.items) {
      setInventory((prevInv) => {
        const nextInv = prevInv.map((invItem) => {
          const matchedQuoteItem = target.quote?.items.find(
            (qi) =>
              qi.item_type === 'peca' &&
              (invItem.name.toLowerCase().includes(qi.item_name.toLowerCase()) ||
                qi.item_name.toLowerCase().includes(invItem.name.toLowerCase()))
          );
          if (matchedQuoteItem) {
            return {
              ...invItem,
              quantity_in_stock: Math.max(0, invItem.quantity_in_stock - matchedQuoteItem.quantity)
            };
          }
          return invItem;
        });
        saveStoredInventory(nextInv);
        return nextInv;
      });
    }

    decideQuoteRemote(ticketId, approved, decisionByName, reason);
  };

  /**
   * 7. Conclusão do Chamado com Coleta da Assinatura Digital do Diretor
   */
  const completeTicket = (
    ticketId: string,
    technicianId: string,
    data: TicketCompletionData
  ): boolean => {
    const target = tickets.find((t) => t.id === ticketId);
    if (!target) return false;

    if (target.status === 'aguardando_orcamento' || (target.quote && target.quote.status === 'pendente')) {
      alert('Atenção: Este chamado possui um orçamento pendente de aprovação! O orçamento precisa ser aprovado pelo cliente antes de concluir a Ordem de Serviço.');
      return false;
    }

    const transitionVal = validateStateTransition(target.status, 'concluido', { completionData: data });
    if (!transitionVal.valid) {
      console.warn('Conclusão rejeitada pela máquina de estados:', transitionVal.error);
      alert(transitionVal.error || 'Não foi possível validar os dados de conclusão da OS.');
      return false;
    }

    const tech = technicians.find((t) => t.id === technicianId);
    const completionId = `cmp-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const historyEntry: TicketHistoryEntry = {
      id: `hist-cmp-${Date.now()}`,
      created_at: nowIso,
      action_type: 'status_change',
      from_status: target.status,
      to_status: 'concluido',
      author_name: tech?.name || target.assigned_technician_name || 'Técnico Responsável',
      author_role: 'Técnico Credenciado',
      note: `OS concluída e assinada por ${data.school_representative_name} (${data.school_representative_doc}). Resumo: ${data.service_summary}`
    };

    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: 'concluido' as const,
            resolved_at: nowIso,
            updated_at: nowIso,
            notes: historyEntry.note,
            history: [historyEntry, ...(t.history || [])],
            completion: {
              id: completionId,
              ticket_id: ticketId,
              technician_id: technicianId,
              technician_name: tech?.name || t.assigned_technician_name || 'Técnico Responsável',
              service_summary: data.service_summary,
              school_representative_name: data.school_representative_name,
              school_representative_doc: data.school_representative_doc,
              signature_svg: data.signature_svg,
              completed_at: nowIso
            }
          };
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

    completeTicketRemote(
      ticketId,
      data.service_summary,
      data.school_representative_name,
      data.school_representative_doc,
      data.signature_svg
    );

    return true;
  };

  /**
   * 8. PWA Técnico: Agendar visita presencial com o gestor (Pausa programada)
   */
  const scheduleVisit = (ticketId: string, scheduledAt: string, notes: string) => {
    const nowIso = new Date().toISOString();
    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId) {
          const formattedDate = new Date(scheduledAt).toLocaleString('pt-BR');
          const histEntry: TicketHistoryEntry = {
            id: `hist-visit-${Date.now()}`,
            created_at: nowIso,
            action_type: 'status_change',
            from_status: t.status,
            to_status: 'visita_agendada',
            author_name: t.assigned_technician_name || 'Técnico de Campo',
            author_role: 'Técnico de Campo',
            note: `Chamado pausado/agendado para ${formattedDate}. ${notes ? `Obs: ${notes}` : ''}`
          };
          const notif = {
            id: `notif-visit-${Date.now()}`,
            ticket_id: t.id,
            type: 'visita' as const,
            recipient_role: 'escola' as const,
            recipient_phone_or_email: t.requester_phone,
            channel: 'whatsapp' as const,
            title: 'Visita Técnica Agendada',
            message: `Olá ${t.requester_name}! O técnico HelpTech agendou a visita técnica para ${formattedDate}. Obs: ${notes || 'Sem observações adicionais.'}`,
            sent_at: nowIso
          };
          return {
            ...t,
            status: 'visita_agendada' as const,
            scheduled_visit_at: scheduledAt,
            scheduled_visit_notes: notes,
            notes: histEntry.note,
            history: [histEntry, ...(t.history || [])],
            updated_at: nowIso,
            notifications: [...(t.notifications || []), notif],
            dispatch_logs: [
              ...t.dispatch_logs,
              {
                id: `log-visit-${Date.now()}`,
                ticket_id: t.id,
                technician_id: t.assigned_technician_id || 'unknown',
                technician_name: t.assigned_technician_name || 'Técnico',
                status: 'notificado' as const,
                refusal_reason: `Visita agendada para ${formattedDate}`,
                created_at: nowIso
              }
            ]
          };
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

    updateRemoteTicketStatus(
      ticketId,
      'visita_agendada',
      { scheduled_visit_at: scheduledAt, scheduled_visit_notes: notes },
      { name: 'Técnico de Campo', role: 'ROLE_TECH' }
    );
  };

  /**
   * 9. PWA Técnico: Sinalizar Aguardando Peça com notificação (Pausa opcional)
   */
  const setWaitingParts = (ticketId: string, partNotes: string) => {
    const nowIso = new Date().toISOString();
    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId) {
          const histEntry: TicketHistoryEntry = {
            id: `hist-part-${Date.now()}`,
            created_at: nowIso,
            action_type: 'status_change',
            from_status: t.status,
            to_status: 'aguardando_peca',
            author_name: t.assigned_technician_name || 'Técnico de Campo',
            author_role: 'Técnico de Campo',
            note: `Chamado pausado (Aguardando Peça): ${partNotes}`
          };
          const notif = {
            id: `notif-part-${Date.now()}`,
            ticket_id: t.id,
            type: 'peca' as const,
            recipient_role: 'escola' as const,
            recipient_phone_or_email: t.requester_phone,
            channel: 'whatsapp' as const,
            title: 'Chamado em Espera de Peça de Reposição',
            message: `Chamado ${t.protocol}: o atendimento foi pausado aguardando envio do componente: ${partNotes}. A Central HelpTech já acionou o estoque.`,
            sent_at: nowIso
          };
          return {
            ...t,
            status: 'aguardando_peca' as const,
            pending_part_notes: partNotes,
            notes: histEntry.note,
            history: [histEntry, ...(t.history || [])],
            updated_at: nowIso,
            notifications: [...(t.notifications || []), notif]
          };
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

    updateRemoteTicketStatus(
      ticketId,
      'aguardando_peca',
      { pending_part_notes: partNotes },
      { name: 'Técnico de Campo', role: 'ROLE_TECH' }
    );
  };

  /**
   * 10. PWA Técnico / Central: Sinalizar Aguardando Serviço de Terceiros (Pausa opcional)
   */
  const setWaitingThirdParty = (ticketId: string, thirdPartyNotes: string) => {
    const nowIso = new Date().toISOString();
    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId) {
          const histEntry: TicketHistoryEntry = {
            id: `hist-third-${Date.now()}`,
            created_at: nowIso,
            action_type: 'status_change',
            from_status: t.status,
            to_status: 'aguardando_terceiro',
            author_name: t.assigned_technician_name || 'Técnico de Campo',
            author_role: 'Técnico de Campo',
            note: `Chamado pausado (Aguardando Terceiro): ${thirdPartyNotes}`
          };
          const notif = {
            id: `notif-third-${Date.now()}`,
            ticket_id: t.id,
            type: 'terceiro' as const,
            recipient_role: 'escola' as const,
            recipient_phone_or_email: t.requester_phone,
            channel: 'whatsapp' as const,
            title: 'Aguardando Atuação de Terceiros',
            message: `Chamado ${t.protocol}: identificada dependência de concessionária/terceiro: ${thirdPartyNotes}. Acompanhamento aberto com o provedor.`,
            sent_at: nowIso
          };
          return {
            ...t,
            status: 'aguardando_terceiro' as const,
            third_party_notes: thirdPartyNotes,
            notes: histEntry.note,
            history: [histEntry, ...(t.history || [])],
            updated_at: nowIso,
            notifications: [...(t.notifications || []), notif]
          };
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

    updateRemoteTicketStatus(
      ticketId,
      'aguardando_terceiro',
      { third_party_notes: thirdPartyNotes },
      { name: 'Técnico / Central', role: 'ROLE_TECH' }
    );
  };

  /**
   * 11. Retomar atendimento (Despausar chamado)
   */
  const resumeService = (ticketId: string) => {
    const nowIso = new Date().toISOString();
    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId) {
          const histEntry: TicketHistoryEntry = {
            id: `hist-res-${Date.now()}`,
            created_at: nowIso,
            action_type: 'status_change',
            from_status: t.status,
            to_status: 'em_atendimento',
            author_name: t.assigned_technician_name || 'Técnico / Central',
            author_role: 'Operação',
            note: 'Atendimento retomado (pausa encerrada).'
          };
          return {
            ...t,
            status: 'em_atendimento' as const,
            notes: histEntry.note,
            history: [histEntry, ...(t.history || [])],
            updated_at: nowIso
          };
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

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

  /**
   * 12.1 Central de Controle: Edição administrativa completa da OS e transição livre de etapas / troca de técnico
   */
  const updateTicketAdmin = async (
    ticketId: string,
    params: {
      status?: Ticket['status'];
      technicianId?: string;
      title?: string;
      description?: string;
      urgencyLevel?: Ticket['urgency_level'];
      equipmentPatrimony?: string;
      notes?: string;
    }
  ) => {
    const targetTicket = tickets.find((t) => t.id === ticketId);
    if (
      params.status === 'concluido' &&
      targetTicket &&
      (targetTicket.status === 'aguardando_orcamento' || (targetTicket.quote && targetTicket.quote.status === 'pendente'))
    ) {
      alert('Atenção: Este chamado possui um orçamento pendente de aprovação! Aprove o orçamento antes de concluir a Ordem de Serviço.');
      return;
    }

    let resolvedTechName: string | undefined = undefined;
    if (params.technicianId !== undefined) {
      if (!params.technicianId) {
        resolvedTechName = '';
      } else {
        const found = technicians.find((t) => t.id === params.technicianId);
        resolvedTechName = found ? found.name : '';
      }
    }

    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId) {
          const nextStatus = params.status || t.status;
          const nextTechId =
            params.technicianId !== undefined
              ? (params.technicianId || undefined)
              : t.assigned_technician_id;
          const nextTechName =
            resolvedTechName !== undefined
              ? resolvedTechName
              : t.assigned_technician_name;

          const updatedLogs = [...t.dispatch_logs];
          if (
            params.technicianId &&
            params.technicianId !== t.assigned_technician_id &&
            resolvedTechName
          ) {
            updatedLogs.push({
              id: `log-admin-${Date.now()}`,
              ticket_id: t.id,
              technician_id: params.technicianId,
              technician_name: resolvedTechName,
              status: 'notificado',
              created_at: new Date().toISOString()
            });
          }

          const newHistEntry: TicketHistoryEntry = {
            id: `hist-${Date.now()}`,
            created_at: new Date().toISOString(),
            action_type: params.notes
              ? 'note_added'
              : (params.status && params.status !== t.status ? 'status_change' : 'admin_edit'),
            from_status: t.status,
            to_status: nextStatus,
            author_name: 'Administrador Central',
            author_role: 'Controladoria',
            note: params.notes || undefined,
            technician_name: nextTechName
          };

          const combinedHistory = [newHistEntry, ...(t.history || [])];

          return {
            ...t,
            status: nextStatus,
            assigned_technician_id: nextTechId,
            assigned_technician_name: nextTechName,
            title: params.title ?? t.title,
            description: params.description ?? t.description,
            urgency_level: params.urgencyLevel ?? t.urgency_level,
            equipment_patrimony:
              params.equipmentPatrimony !== undefined
                ? params.equipmentPatrimony
                : t.equipment_patrimony,
            notes: params.notes || t.notes,
            history: combinedHistory,
            dispatch_logs: updatedLogs,
            updated_at: new Date().toISOString()
          };
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

    await adminUpdateTicketRemote(ticketId, {
      status: params.status,
      technicianId: params.technicianId,
      title: params.title,
      description: params.description,
      urgencyLevel: params.urgencyLevel,
      equipmentPatrimony: params.equipmentPatrimony,
      notes: params.notes
    });
  };

  const manualDispatch = (ticketId: string, technicianId: string) => {
    const tech = technicians.find((t) => t.id === technicianId);
    if (!tech) return;

    const nowIso = new Date().toISOString();
    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id === ticketId) {
          const histEntry: TicketHistoryEntry = {
            id: `hist-man-${Date.now()}`,
            created_at: nowIso,
            action_type: 'status_change',
            from_status: t.status,
            to_status: 'despachado',
            author_name: 'Operador da Central',
            author_role: 'Controladoria',
            technician_name: tech.name,
            note: `Chamado atribuído/despachado manualmente para ${tech.name}.`
          };
          const notif = {
            id: `notif-dispatch-${Date.now()}`,
            ticket_id: t.id,
            type: 'despacho' as const,
            recipient_role: 'tecnico' as const,
            recipient_phone_or_email: tech.phone,
            channel: 'push' as const,
            title: 'Novo Chamado Despachado para Você',
            message: `Novo chamado ${t.protocol} da escola ${t.school_name} foi atribuído a você. Aceite em até 20 minutos no PWA.`,
            sent_at: nowIso
          };
          return {
            ...t,
            status: 'despachado' as const,
            assigned_technician_id: tech.id,
            assigned_technician_name: tech.name,
            dispatch_attempts: t.dispatch_attempts + 1,
            dispatch_timeout_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
            updated_at: nowIso,
            history: [histEntry, ...(t.history || [])],
            notifications: [...(t.notifications || []), notif],
            dispatch_logs: [
              ...t.dispatch_logs,
              {
                id: `log-man-${Date.now()}`,
                ticket_id: t.id,
                technician_id: tech.id,
                technician_name: tech.name,
                status: 'notificado' as const,
                created_at: nowIso
              }
            ]
          };
        }
        return t;
      });
      saveStoredTickets(next);
      return next;
    });

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
  const createTechnician = async (techData: Omit<Technician, 'id'> & { password?: string }) => {
    const tempId = `tech-${Date.now().toString(36)}`;
    const newTech: Technician = {
      ...techData,
      id: tempId
    };
    setTechnicians((prev) => [newTech, ...prev]);

    if (isSupabaseConfigured) {
      try {
        const res = await saveRemoteTechnicianWithAuth(techData);
        if (res.data) {
          setTechnicians((prev) =>
            prev.map((t) => (t.id === tempId ? { ...t, ...res.data } : t))
          );
          return res.data;
        }
      } catch (err) {
        console.warn('Erro ao salvar técnico no banco:', err);
      }
    }
    return newTech;
  };

  const updateTechnician = async (id: string, updates: Partial<Technician> & { password?: string }) => {
    setTechnicians((prev) =>
      prev.map((tech) => (tech.id === id ? { ...tech, ...updates } : tech))
    );

    if (isSupabaseConfigured) {
      try {
        await saveRemoteTechnicianWithAuth({ id, ...updates });
      } catch (err) {
        console.warn('Erro ao atualizar técnico no banco:', err);
      }
    }
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
  const createSystemUser = async (userData: Omit<SystemUser, 'id' | 'created_at'> & { password?: string }) => {
    const tempId = `usr-${Date.now().toString(36)}`;
    const newUser: SystemUser = {
      ...userData,
      id: tempId,
      created_at: new Date().toISOString()
    };
    setSystemUsers((prev) => [newUser, ...prev]);

    if (isSupabaseConfigured) {
      try {
        const res = await saveRemoteSystemUserWithAuth(userData);
        if (res.data) {
          setSystemUsers((prev) =>
            prev.map((u) => (u.id === tempId ? { ...u, ...res.data } : u))
          );
          return res.data;
        }
      } catch (err) {
        console.warn('Erro ao salvar usuário no banco:', err);
      }
    }
    return newUser;
  };

  const updateSystemUser = async (id: string, updates: Partial<SystemUser> & { password?: string }) => {
    setSystemUsers((prev) =>
      prev.map((usr) => (usr.id === id ? { ...usr, ...updates } : usr))
    );

    if (isSupabaseConfigured) {
      try {
        await saveRemoteSystemUserWithAuth({ id, ...updates });
      } catch (err) {
        console.warn('Erro ao atualizar usuário no banco:', err);
      }
    }
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

    const updateInventoryQuantity = (id: string, delta: number) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity_in_stock: Math.max(0, item.quantity_in_stock + delta) } : item
      )
    );
  };

  const addInventoryItem = (item: Omit<InventoryItem, 'id'>) => {
    const newEntry: InventoryItem = {
      ...item,
      id: 'inv-' + Date.now().toString().slice(-4)
    };
    setInventory((prev) => [...prev, newEntry]);
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const deleteInventoryItem = (id: string) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
  };

  const submitTicketCsat = (ticketId: string, rating: number, comment?: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            csat_rating: rating,
            csat_comment: comment || '',
            csat_at: new Date().toISOString()
          };
        }
        return t;
      })
    );
  };

  /**
   * Adiciona nota ou parecer com histórico imediato na OS
   */
  const addTicketNote = async (
    ticketId: string,
    noteText: string,
    authorName = 'Administrador HelpTech',
    authorRole = 'Controladoria / Campo'
  ) => {
    if (!noteText.trim()) return;
    const cleanNote = noteText.trim();

    setTickets((prev) => {
      const updated = prev.map((t) => {
        if (t.id === ticketId) {
          const entry: TicketHistoryEntry = {
            id: `hist-note-${Date.now()}`,
            created_at: new Date().toISOString(),
            action_type: 'note_added',
            from_status: t.status,
            to_status: t.status,
            author_name: authorName,
            author_role: authorRole,
            note: cleanNote
          };
          return {
            ...t,
            notes: cleanNote,
            history: [entry, ...(t.history || [])],
            updated_at: new Date().toISOString()
          };
        }
        return t;
      });
      saveStoredTickets(updated);
      return updated;
    });

    await adminUpdateTicketRemote(ticketId, {
      notes: cleanNote
    });
  };

  return {
    tickets,
    inventory,
    updateInventoryQuantity,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    submitTicketCsat,
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
    updateTicketAdmin,
    addTicketNote,
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
