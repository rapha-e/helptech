import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  School,
  Technician,
  SystemUser,
  TicketCategory,
  RegionalCoordination
} from '../data/seedData';
import {
  SCHOOLS,
  TECHNICIANS,
  INITIAL_SYSTEM_USERS,
  TICKET_CATEGORIES,
  REGIONAL_COORDINATIONS
} from '../data/seedData';
import type { RemoteServiceResult } from './ticketService';

/**
 * Consulta lista de unidades escolares
 */
export async function fetchRemoteSchools(): Promise<RemoteServiceResult<School[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: SCHOOLS, error: null, fromFallback: true };
  }

  try {
    const { data, error } = await supabase
      .from('schools')
      .select('*, regional_coordinations(name)')
      .order('name');

    if (error || !data || data.length === 0) {
      return { data: SCHOOLS, error: error?.message || null, fromFallback: true };
    }

    const mapped: School[] = data.map((row: any) => ({
      id: row.id,
      cre_id: row.cre_id,
      inep: row.inep,
      name: row.name,
      address: row.address,
      cep: row.cep || undefined,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      cre_name: row.regional_coordinations?.name || 'CRE',
      contact_phone: row.contact_phone || undefined,
      contact_email: row.contact_email || undefined
    }));

    return { data: mapped, error: null, fromFallback: false };
  } catch (err: any) {
    return { data: SCHOOLS, error: err.message, fromFallback: true };
  }
}

/**
 * Consulta lista de técnicos cadastrados
 */
export async function fetchRemoteTechnicians(): Promise<RemoteServiceResult<Technician[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: TECHNICIANS, error: null, fromFallback: true };
  }

  try {
    const { data, error } = await supabase
      .from('technicians')
      .select('*, regional_coordinations(name)')
      .eq('active', true)
      .order('name');

    if (error || !data || data.length === 0) {
      return { data: TECHNICIANS, error: error?.message || null, fromFallback: true };
    }

    const mapped: Technician[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email || `${row.name.toLowerCase().replace(/\s+/g, '.')}@helptech.com.br`,
      primary_cre_id: row.primary_cre_id || 'cre-geral',
      primary_cre_name: row.regional_coordinations?.name || 'CRE Geral',
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      radius_km: row.radius_km || 30,
      max_active_tickets: row.max_active_tickets || 4,
      status: row.status,
      active: row.active ?? true
    }));

    return { data: mapped, error: null, fromFallback: false };
  } catch (err: any) {
    return { data: TECHNICIANS, error: err.message, fromFallback: true };
  }
}

function isUuid(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Salva ou atualiza técnico de campo com senha de autenticação atômica no Supabase
 */
export async function saveRemoteTechnicianWithAuth(
  techData: Partial<Technician> & { password?: string }
): Promise<RemoteServiceResult<Technician>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: 'Supabase não configurado', fromFallback: true };
  }

  try {
    // Se o ID for de seed (ex: 'tech-carlos'), tenta localizar o UUID correspondente no Supabase pelo email
    let resolvedId: string | null = isUuid(techData.id) ? techData.id! : null;
    if (!resolvedId && techData.email) {
      try {
        const { data: existing } = await supabase
          .from('technicians')
          .select('id')
          .eq('email', techData.email)
          .maybeSingle();
        if (existing?.id) {
          resolvedId = existing.id;
        }
      } catch {
        // ignora
      }
    }

    // Tenta primeiro a RPC atômica caso esteja instalada
    const { data: rpcData, error: rpcError } = await supabase.rpc('save_technician_with_auth', {
      p_id: resolvedId,
      p_name: techData.name,
      p_phone: techData.phone,
      p_email: techData.email,
      p_primary_cre_id: techData.primary_cre_id || null,
      p_latitude: techData.latitude ?? -15.793889,
      p_longitude: techData.longitude ?? -47.882778,
      p_radius_km: techData.radius_km || 30,
      p_max_active_tickets: techData.max_active_tickets || 4,
      p_status: techData.status || 'disponivel',
      p_password: techData.password || null
    });

    if (!rpcError && rpcData) {
      return { data: rpcData as Technician, error: null, fromFallback: false };
    }

    // Fallback de atualização direta na tabela technicians se a RPC não estiver disponível
    const updatePayload: Record<string, any> = {
      name: techData.name,
      phone: techData.phone,
      email: techData.email,
      primary_cre_id: techData.primary_cre_id,
      latitude: techData.latitude,
      longitude: techData.longitude,
      radius_km: techData.radius_km,
      max_active_tickets: techData.max_active_tickets,
      status: techData.status || 'disponivel',
      active: techData.active ?? true
    };

    if (resolvedId) {
      const { data: updData, error: updErr } = await supabase
        .from('technicians')
        .update(updatePayload)
        .eq('id', resolvedId)
        .select()
        .maybeSingle();
      if (!updErr && updData) {
        return { data: updData as Technician, error: null, fromFallback: false };
      }
    } else if (techData.email) {
      const { data: updData, error: updErr } = await supabase
        .from('technicians')
        .update(updatePayload)
        .eq('email', techData.email)
        .select()
        .maybeSingle();
      if (!updErr && updData) {
        return { data: updData as Technician, error: null, fromFallback: false };
      }
    }

    return { data: techData as Technician, error: rpcError?.message || null, fromFallback: false };
  } catch (err: any) {
    return { data: techData as Technician, error: err.message, fromFallback: true };
  }
}

/**
 * Remove técnico de campo do Supabase (com suporte a soft-delete em caso de histórico de OS)
 */
export async function deleteRemoteTechnician(
  id: string,
  email?: string
): Promise<RemoteServiceResult<boolean>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: true, error: null, fromFallback: true };
  }

  try {
    let targetId = isUuid(id) ? id : null;
    if (!targetId && email) {
      const { data: existing } = await supabase
        .from('technicians')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (existing?.id) targetId = existing.id;
    }

    // Tenta desvincular chamados abertos atribuídos para liberar a FK antes do delete
    try {
      if (targetId) {
        await supabase
          .from('tickets')
          .update({ assigned_technician_id: null, assigned_technician_name: null })
          .eq('assigned_technician_id', targetId);
      }
    } catch {
      // ignora se falhar
    }

    // Tenta exclusão física direta
    const filterCol = targetId ? 'id' : email ? 'email' : 'id';
    const filterVal = targetId || email || id;

    const { error: delErr } = await supabase
      .from('technicians')
      .delete()
      .eq(filterCol, filterVal);

    if (delErr) {
      // Se houver histórico não desvinculável, inativa o técnico para que não apareça mais
      console.warn('Exclusão com histórico de OS, inativando técnico no banco:', delErr.message);
      await supabase
        .from('technicians')
        .update({ active: false, status: 'indisponivel' })
        .eq(filterCol, filterVal);
    }

    return { data: true, error: null, fromFallback: false };
  } catch (err: any) {
    return { data: false, error: err.message, fromFallback: true };
  }
}

/**
 * Consulta lista de usuários administrativos (RBAC)
 */
export async function fetchRemoteSystemUsers(): Promise<RemoteServiceResult<SystemUser[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: INITIAL_SYSTEM_USERS, error: null, fromFallback: true };
  }

  try {
    const { data, error } = await supabase
      .from('system_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return { data: INITIAL_SYSTEM_USERS, error: error?.message || null, fromFallback: true };
    }

    const mapped: SystemUser[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || '',
      role: row.role,
      active: row.active ?? true,
      created_at: row.created_at
    }));

    return { data: mapped, error: null, fromFallback: false };
  } catch (err: any) {
    return { data: INITIAL_SYSTEM_USERS, error: err.message, fromFallback: true };
  }
}

/**
 * Salva ou atualiza usuário do sistema/administrador com senha de autenticação atômica no Supabase
 */
export async function saveRemoteSystemUserWithAuth(
  userData: Partial<SystemUser> & { password?: string }
): Promise<RemoteServiceResult<SystemUser>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: 'Supabase não configurado', fromFallback: true };
  }

  try {
    let resolvedId: string | null = isUuid(userData.id) ? userData.id! : null;
    if (!resolvedId && userData.email) {
      try {
        const { data: existing } = await supabase
          .from('system_users')
          .select('id')
          .eq('email', userData.email)
          .maybeSingle();
        if (existing?.id) {
          resolvedId = existing.id;
        }
      } catch {
        // ignora
      }
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('save_system_user_with_auth', {
      p_id: resolvedId,
      p_name: userData.name,
      p_phone: userData.phone,
      p_email: userData.email,
      p_role: userData.role || 'controladoria',
      p_active: userData.active ?? true,
      p_password: userData.password || null
    });

    if (!rpcError && rpcData) {
      return { data: rpcData as SystemUser, error: null, fromFallback: false };
    }

    // Fallback de atualização direta na tabela system_users
    const updatePayload: Record<string, any> = {
      name: userData.name,
      phone: userData.phone,
      email: userData.email,
      role: userData.role || 'controladoria',
      active: userData.active ?? true
    };

    if (resolvedId) {
      const { data: updData, error: updErr } = await supabase
        .from('system_users')
        .update(updatePayload)
        .eq('id', resolvedId)
        .select()
        .maybeSingle();
      if (!updErr && updData) {
        return { data: updData as SystemUser, error: null, fromFallback: false };
      }
    } else if (userData.email) {
      const { data: updData, error: updErr } = await supabase
        .from('system_users')
        .update(updatePayload)
        .eq('email', userData.email)
        .select()
        .maybeSingle();
      if (!updErr && updData) {
        return { data: updData as SystemUser, error: null, fromFallback: false };
      }
    }

    return { data: userData as SystemUser, error: rpcError?.message || null, fromFallback: false };
  } catch (err: any) {
    return { data: userData as SystemUser, error: err.message, fromFallback: true };
  }
}

/**
 * Remove usuário do sistema/administrador do Supabase (com suporte a soft-delete)
 */
export async function deleteRemoteSystemUser(
  id: string,
  email?: string
): Promise<RemoteServiceResult<boolean>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: true, error: null, fromFallback: true };
  }

  try {
    let targetId = isUuid(id) ? id : null;
    if (!targetId && email) {
      const { data: existing } = await supabase
        .from('system_users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (existing?.id) targetId = existing.id;
    }

    const filterCol = targetId ? 'id' : email ? 'email' : 'id';
    const filterVal = targetId || email || id;

    const { error: delErr } = await supabase
      .from('system_users')
      .delete()
      .eq(filterCol, filterVal);

    if (delErr) {
      console.warn('Exclusão de usuário com restrição, aplicando inativação:', delErr.message);
      await supabase
        .from('system_users')
        .update({ active: false })
        .eq(filterCol, filterVal);
    }

    return { data: true, error: null, fromFallback: false };
  } catch (err: any) {
    return { data: false, error: err.message, fromFallback: true };
  }
}

/**
 * Consulta categorias de chamados
 */
export async function fetchRemoteCategories(): Promise<RemoteServiceResult<TicketCategory[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: TICKET_CATEGORIES, error: null, fromFallback: true };
  }

  try {
    const { data, error } = await supabase
      .from('ticket_categories')
      .select('*')
      .order('name');

    if (error || !data || data.length === 0) {
      return { data: TICKET_CATEGORIES, error: error?.message || null, fromFallback: true };
    }

    const mapped: TicketCategory[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      sla_response_hours: row.sla_response_hours,
      sla_resolution_hours: row.sla_resolution_hours,
      active: row.active ?? true
    }));

    return { data: mapped, error: null, fromFallback: false };
  } catch (err: any) {
    return { data: TICKET_CATEGORIES, error: err.message, fromFallback: true };
  }
}

/**
 * Consulta coordenações regionais (CREs)
 */
export async function fetchRemoteRegions(): Promise<RemoteServiceResult<RegionalCoordination[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: REGIONAL_COORDINATIONS, error: null, fromFallback: true };
  }

  try {
    const { data, error } = await supabase
      .from('regional_coordinations')
      .select('*')
      .order('name');

    if (error || !data || data.length === 0) {
      return { data: REGIONAL_COORDINATIONS, error: error?.message || null, fromFallback: true };
    }

    const mapped: RegionalCoordination[] = data.map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      active: row.active ?? true
    }));

    return { data: mapped, error: null, fromFallback: false };
  } catch (err: any) {
    return { data: REGIONAL_COORDINATIONS, error: err.message, fromFallback: true };
  }
}
