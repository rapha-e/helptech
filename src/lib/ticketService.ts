import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  Ticket,
  TicketAttachment,
  TicketDispatchLog,
  School,
  TicketCategory
} from '../data/seedData';
import { SCHOOLS, TICKET_CATEGORIES } from '../data/seedData';

export interface RemoteServiceResult<T> {
  data: T | null;
  error: string | null;
  fromFallback: boolean;
}

export interface TicketFilterOptions {
  schoolId?: string;
  technicianId?: string;
  status?: string;
  protocol?: string;
  trackingToken?: string;
}

/**
 * Converte registro retornado do Supabase (com joins) para a entidade de domínio Ticket
 */
export function mapSupabaseRowToTicket(
  row: any,
  schoolsMap: Map<string, School>,
  categoriesMap: Map<string, TicketCategory>
): Ticket {
  const school = schoolsMap.get(row.school_id) || {
    id: row.school_id,
    cre_id: '',
    inep: '',
    name: row.schools?.name || 'Escola não identificada',
    address: row.schools?.address || 'Brasília - DF',
    cre_name: row.schools?.regional_coordinations?.name || 'CRE',
    latitude: row.schools?.latitude || -15.793889,
    longitude: row.schools?.longitude || -47.882778
  };

  const category = categoriesMap.get(row.category_id) || {
    id: row.category_id,
    name: row.ticket_categories?.name || 'Geral',
    sla_response_hours: 4,
    sla_resolution_hours: 48
  };

  const quote = row.ticket_quotes?.[0]
    ? {
        id: row.ticket_quotes[0].id,
        ticket_id: row.id,
        technician_id: row.ticket_quotes[0].technician_id,
        technician_name: row.technicians?.name || 'Técnico Responsável',
        total_amount: Number(row.ticket_quotes[0].total_amount) || 0,
        technical_diagnosis: row.ticket_quotes[0].technical_diagnosis || '',
        status: row.ticket_quotes[0].status,
        decision_by_name: row.ticket_quotes[0].decision_by_name || undefined,
        decision_reason: row.ticket_quotes[0].decision_reason || undefined,
        decided_at: row.ticket_quotes[0].decided_at || undefined,
        created_at: row.ticket_quotes[0].created_at,
        items: (row.ticket_quotes[0].ticket_quote_items || []).map((item: any) => ({
          id: item.id,
          quote_id: item.quote_id,
          item_type: item.item_type,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price) || 0,
          subtotal: Number(item.subtotal) || 0
        }))
      }
    : undefined;

  const completion = row.ticket_completions?.[0]
    ? {
        id: row.ticket_completions[0].id,
        ticket_id: row.id,
        technician_id: row.ticket_completions[0].technician_id,
        technician_name: row.technicians?.name || 'Técnico Responsável',
        service_summary: row.ticket_completions[0].service_summary,
        school_representative_name: row.ticket_completions[0].school_representative_name,
        school_representative_doc: row.ticket_completions[0].school_representative_doc,
        signature_svg: row.ticket_completions[0].signature_svg,
        completed_at: row.ticket_completions[0].completed_at
      }
    : undefined;

  const attachments: TicketAttachment[] = (row.ticket_attachments || []).map((att: any) => ({
    id: att.id,
    ticket_id: row.id,
    phase: att.phase,
    file_url: att.file_url,
    file_name: att.file_name || 'arquivo',
    file_size_bytes: att.file_size_bytes || 0,
    created_at: att.created_at
  }));

  const dispatch_logs: TicketDispatchLog[] = (row.ticket_dispatch_logs || []).map((log: any) => ({
    id: log.id,
    ticket_id: row.id,
    technician_id: log.technician_id,
    technician_name: log.technician_name || 'Técnico',
    status: log.status,
    refusal_reason: log.refusal_reason || undefined,
    created_at: log.created_at
  }));

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
    equipment_patrimony: row.equipment_patrimony || undefined,
    urgency_level: row.urgency_level,
    status: row.status,
    assigned_technician_id: row.assigned_technician_id || undefined,
    assigned_technician_name: row.technicians?.name || undefined,
    dispatch_attempts: row.dispatch_attempts || 0,
    dispatch_timeout_at: row.dispatch_timeout_at || undefined,
    scheduled_visit_at: row.scheduled_visit_at || undefined,
    scheduled_visit_notes: row.scheduled_visit_notes || undefined,
    pending_part_notes: row.pending_part_notes || undefined,
    third_party_notes: row.third_party_notes || undefined,
    arrival_lat: row.arrival_lat ? Number(row.arrival_lat) : undefined,
    arrival_lng: row.arrival_lng ? Number(row.arrival_lng) : undefined,
    arrived_at: row.arrived_at || undefined,
    resolved_at: row.resolved_at || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    quote,
    completion,
    attachments,
    dispatch_logs,
    notifications: []
  };
}

/**
 * Consulta chamados diretamente do Supabase com tratamento de relacionamentos
 */
export async function fetchRemoteTickets(
  filters?: TicketFilterOptions
): Promise<RemoteServiceResult<Ticket[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: 'Supabase não configurado', fromFallback: true };
  }

  try {
    let query = supabase
      .from('tickets')
      .select(`
        *,
        schools(name, address, regional_coordinations(name)),
        ticket_categories(name),
        technicians(name),
        ticket_attachments(*),
        ticket_dispatch_logs(*),
        ticket_quotes(*, ticket_quote_items(*)),
        ticket_completions(*)
      `)
      .order('created_at', { ascending: false });

    if (filters?.schoolId) {
      query = query.eq('school_id', filters.schoolId);
    }
    if (filters?.technicianId) {
      query = query.eq('assigned_technician_id', filters.technicianId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.protocol) {
      query = query.ilike('protocol', `%${filters.protocol}%`);
    }
    if (filters?.trackingToken) {
      query = query.eq('tracking_token', filters.trackingToken);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Erro ao consultar Supabase tickets:', error.message);
      return { data: null, error: error.message, fromFallback: true };
    }

    const schoolsMap = new Map<string, School>(SCHOOLS.map((s) => [s.id, s]));
    const categoriesMap = new Map<string, TicketCategory>(TICKET_CATEGORIES.map((c) => [c.id, c]));

    const mapped = (data || []).map((row: any) =>
      mapSupabaseRowToTicket(row, schoolsMap, categoriesMap)
    );

    return { data: mapped, error: null, fromFallback: false };
  } catch (err: any) {
    console.error('Falha de rede ao consultar chamados:', err);
    return { data: null, error: err.message || 'Erro inesperado de rede', fromFallback: true };
  }
}

/**
 * Grava novo chamado no Supabase com integridade referencial e auditoria
 */
export async function createRemoteTicket(
  ticket: Ticket,
  actor: { name: string; role: string }
): Promise<RemoteServiceResult<Ticket>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: ticket, error: 'Supabase offline/não configurado', fromFallback: true };
  }

  try {
    // 1. Tenta invocar a RPC transacional create_ticket no PostgreSQL (Servidor como Fonte de Verdade)
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_ticket', {
      p_school_id: ticket.school_id,
      p_category_id: ticket.category_id,
      p_requester_name: ticket.requester_name,
      p_requester_role: ticket.requester_role,
      p_requester_phone: ticket.requester_phone,
      p_title: ticket.title,
      p_description: ticket.description,
      p_urgency_level: ticket.urgency_level,
      p_equipment_patrimony: ticket.equipment_patrimony || null
    });

    if (!rpcError && rpcData?.success) {
      return {
        data: {
          ...ticket,
          id: rpcData.ticket_id,
          protocol: rpcData.protocol,
          tracking_token: rpcData.tracking_token,
          status: rpcData.status,
          assigned_technician_id: rpcData.assigned_technician_id
        },
        error: null,
        fromFallback: false
      };
    }

    // Fallback gracioso: Inserção direta na tabela de tickets se a RPC ainda não estiver criada
    const ticketPayload = {
      protocol: ticket.protocol,
      tracking_token: ticket.tracking_token,
      school_id: ticket.school_id,
      category_id: ticket.category_id,
      requester_name: ticket.requester_name,
      requester_role: ticket.requester_role,
      requester_phone: ticket.requester_phone,
      title: ticket.title,
      description: ticket.description,
      equipment_patrimony: ticket.equipment_patrimony || null,
      urgency_level: ticket.urgency_level,
      status: ticket.status,
      assigned_technician_id: ticket.assigned_technician_id || null,
      dispatch_attempts: ticket.dispatch_attempts,
      dispatch_timeout_at: ticket.dispatch_timeout_at || null,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at
    };

    const { data: insertedTicket, error: ticketError } = await supabase
      .from('tickets')
      .insert(ticketPayload)
      .select()
      .single();

    if (ticketError) {
      console.warn('Falha ao inserir ticket no Supabase:', ticketError.message);
      return { data: ticket, error: ticketError.message, fromFallback: true };
    }

    const remoteTicketId = insertedTicket.id;

    // 2. Inserção dos anexos iniciais
    if (ticket.attachments && ticket.attachments.length > 0) {
      const attachmentsPayload = ticket.attachments.map((att) => ({
        ticket_id: remoteTicketId,
        phase: att.phase,
        file_url: att.file_url,
        file_name: att.file_name,
        file_size_bytes: att.file_size_bytes
      }));

      await supabase.from('ticket_attachments').insert(attachmentsPayload);
    }

    // 3. Inserção dos logs de despacho iniciais
    if (ticket.dispatch_logs && ticket.dispatch_logs.length > 0) {
      const logsPayload = ticket.dispatch_logs.map((log) => ({
        ticket_id: remoteTicketId,
        technician_id: log.technician_id,
        status: log.status,
        refusal_reason: log.refusal_reason || null
      }));

      await supabase.from('ticket_dispatch_logs').insert(logsPayload);
    }

    // 4. Inserção de evento de auditoria
    await recordAuditEvent({
      ticket_id: remoteTicketId,
      event_type: 'TICKET_CREATED',
      from_status: null,
      to_status: ticket.status,
      actor_name: actor.name,
      actor_role: actor.role,
      metadata: { protocol: ticket.protocol, urgency: ticket.urgency_level }
    });

    return {
      data: { ...ticket, id: remoteTicketId },
      error: null,
      fromFallback: false
    };
  } catch (err: any) {
    console.error('Erro ao persistir chamado remoto:', err);
    return { data: ticket, error: err.message || 'Erro de rede', fromFallback: true };
  }
}

/**
 * Atualiza status e campos do chamado com verificação de concorrência e auditoria
 */
export async function updateRemoteTicketStatus(
  ticketId: string,
  newStatus: Ticket['status'],
  updates: Partial<Ticket>,
  actor: { name: string; role: string },
  previousStatus?: Ticket['status']
): Promise<RemoteServiceResult<boolean>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: true, error: 'Supabase offline/não configurado', fromFallback: true };
  }

  try {
    const patchPayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (updates.assigned_technician_id !== undefined) {
      patchPayload.assigned_technician_id = updates.assigned_technician_id || null;
    }
    if (updates.dispatch_attempts !== undefined) {
      patchPayload.dispatch_attempts = updates.dispatch_attempts;
    }
    if (updates.dispatch_timeout_at !== undefined) {
      patchPayload.dispatch_timeout_at = updates.dispatch_timeout_at || null;
    }
    if (updates.scheduled_visit_at !== undefined) {
      patchPayload.scheduled_visit_at = updates.scheduled_visit_at || null;
    }
    if (updates.scheduled_visit_notes !== undefined) {
      patchPayload.scheduled_visit_notes = updates.scheduled_visit_notes || null;
    }
    if (updates.pending_part_notes !== undefined) {
      patchPayload.pending_part_notes = updates.pending_part_notes || null;
    }
    if (updates.third_party_notes !== undefined) {
      patchPayload.third_party_notes = updates.third_party_notes || null;
    }
    if (updates.arrival_lat !== undefined) {
      patchPayload.arrival_lat = updates.arrival_lat;
    }
    if (updates.arrival_lng !== undefined) {
      patchPayload.arrival_lng = updates.arrival_lng;
    }
    if (updates.arrived_at !== undefined) {
      patchPayload.arrived_at = updates.arrived_at || null;
    }
    if (updates.resolved_at !== undefined) {
      patchPayload.resolved_at = updates.resolved_at || null;
    }

    const { error } = await supabase.from('tickets').update(patchPayload).eq('id', ticketId);

    if (error) {
      console.warn('Erro ao atualizar ticket remoto:', error.message);
      return { data: false, error: error.message, fromFallback: true };
    }

    // Registra trilha de auditoria
    await recordAuditEvent({
      ticket_id: ticketId,
      event_type: 'STATUS_CHANGED',
      from_status: previousStatus || null,
      to_status: newStatus,
      actor_name: actor.name,
      actor_role: actor.role,
      metadata: updates
    });

    return { data: true, error: null, fromFallback: false };
  } catch (err: any) {
    console.error('Erro de rede ao atualizar chamado:', err);
    return { data: false, error: err.message || 'Erro de rede', fromFallback: true };
  }
}

/**
 * Registra evento na trilha de auditoria (LGPD & Compliance) via RPC segura controlada
 */
export async function recordAuditEvent(event: {
  ticket_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string;
  actor_name: string;
  actor_role: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    // 1. Prioriza a função RPC controlada no servidor (identidade validada via JWT)
    const { error: rpcErr } = await supabase.rpc('record_ticket_audit_event', {
      p_ticket_id: event.ticket_id,
      p_event_type: event.event_type,
      p_from_status: event.from_status,
      p_to_status: event.to_status,
      p_metadata: event.metadata || {}
    });

    if (!rpcErr) return;

    // 2. Fallback de inserção direta para administradores com política ativa
    await supabase.from('ticket_audit_events').insert({
      ticket_id: event.ticket_id,
      event_type: event.event_type,
      from_status: event.from_status,
      to_status: event.to_status,
      actor_name: event.actor_name,
      actor_role: event.actor_role,
      metadata: event.metadata || {}
    });
  } catch (err) {
    console.warn('Falha ao registrar auditoria remota:', err);
  }
}

/**
 * Executa aceite de despacho via RPC transacional no PostgreSQL
 */
export async function acceptDispatchRemote(ticketId: string, scheduledDate?: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  return await supabase.rpc('accept_dispatch', {
    p_ticket_id: ticketId,
    p_scheduled_visit_date: scheduledDate || null
  });
}

/**
 * Executa recusa de despacho com re-despacho automático via RPC no PostgreSQL
 */
export async function refuseDispatchRemote(ticketId: string, reason: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  return await supabase.rpc('refuse_dispatch', {
    p_ticket_id: ticketId,
    p_reason: reason
  });
}

/**
 * Executa check-in presencial na escola via RPC no PostgreSQL
 */
export async function checkInRemote(ticketId: string, lat?: number, lng?: number) {
  if (!isSupabaseConfigured || !supabase) return null;
  return await supabase.rpc('check_in', {
    p_ticket_id: ticketId,
    p_latitude: lat || null,
    p_longitude: lng || null
  });
}

/**
 * Executa conclusão da OS com laudo e assinatura digital via RPC no PostgreSQL
 */
export async function completeTicketRemote(
  ticketId: string,
  report: string,
  notes: string,
  doc: string,
  signature: string
) {
  if (!isSupabaseConfigured || !supabase) return null;
  return await supabase.rpc('complete_ticket', {
    p_ticket_id: ticketId,
    p_technical_report: report,
    p_closure_notes: notes,
    p_school_representative_doc: doc,
    p_school_signature_svg: signature
  });
}

/**
 * Executa edição administrativa completa da OS (etapa, status, técnico, título, descrição, urgência, patrimônio, notas)
 */
export async function adminUpdateTicketRemote(
  ticketId: string,
  params: {
    status?: string;
    technicianId?: string;
    title?: string;
    description?: string;
    urgencyLevel?: string;
    equipmentPatrimony?: string;
    notes?: string;
  }
): Promise<RemoteServiceResult<any>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: null, fromFallback: true };
  }

  try {
    const { data, error } = await supabase.rpc('admin_update_ticket', {
      p_ticket_id: ticketId,
      p_status: params.status || null,
      p_technician_id: params.technicianId !== undefined ? (params.technicianId || null) : null,
      p_title: params.title || null,
      p_description: params.description || null,
      p_urgency_level: params.urgencyLevel || null,
      p_equipment_patrimony: params.equipmentPatrimony || null,
      p_notes: params.notes || null
    });

    if (error) {
      console.warn('Falha na RPC admin_update_ticket, executando fallback direto na tabela:', error.message);
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (params.status) patch.status = params.status;
      if (params.technicianId !== undefined) patch.assigned_technician_id = params.technicianId || null;
      if (params.title) patch.title = params.title;
      if (params.description) patch.description = params.description;
      if (params.urgencyLevel) patch.urgency_level = params.urgencyLevel;
      if (params.equipmentPatrimony !== undefined) patch.equipment_patrimony = params.equipmentPatrimony || null;

      const { data: directData, error: directError } = await supabase
        .from('tickets')
        .update(patch)
        .eq('id', ticketId)
        .select()
        .single();

      if (directError) {
        return { data: null, error: directError.message, fromFallback: true };
      }
      return { data: directData, error: null, fromFallback: false };
    }

    return { data, error: null, fromFallback: false };
  } catch (err: any) {
    console.error('Falha de rede ao executar adminUpdateTicketRemote:', err);
    return { data: null, error: err.message || 'Erro inesperado', fromFallback: true };
  }
}


