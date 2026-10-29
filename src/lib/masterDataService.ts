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
    const { data, error } = await supabase.rpc('save_technician_with_auth', {
      p_id: techData.id && !techData.id.startsWith('tech-') ? techData.id : null,
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

    if (error) {
      return { data: null, error: error.message, fromFallback: false };
    }

    return { data: data as Technician, error: null, fromFallback: false };
  } catch (err: any) {
    return { data: null, error: err.message, fromFallback: true };
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
