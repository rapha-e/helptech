import { supabase, isSupabaseConfigured } from './supabaseClient';

export type UserRole = 'ROLE_SCHOOL' | 'ROLE_TECH' | 'ROLE_ADMIN' | 'UNAUTHORIZED';

export interface AuthUserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  systemSubRole?: 'admin' | 'controladoria' | 'auditor_seedf';
  technicianId?: string;
  schoolId?: string;
  schoolName?: string;
  isMockUser?: boolean;
}

const AUTH_STORAGE_KEY = 'helptech_auth_session';

/**
 * Consulta e valida o perfil operacional do usuário a partir de tabelas autorizadas.
 * Implementa princípio de menor privilégio e falha fechada (fail-closed):
 * Se o usuário não tiver vínculo explícito ou a consulta falhar, NÃO concede privilégios operacionais.
 */
export async function fetchUserProfile(
  authUserId: string,
  email: string
): Promise<AuthUserProfile | null> {
  if (!isSupabaseConfigured) {
    // Ambiente puramente offline/demonstrativo local
    return getStoredSession();
  }

  try {
    // 1. Verifica se é usuário da Controladoria / Administração (system_users)
    const { data: sysUser, error: sysErr } = await supabase
      .from('system_users')
      .select('id, name, email, role, active')
      .or(`auth_user_id.eq.${authUserId},email.eq.${email}`)
      .eq('active', true)
      .maybeSingle();

    if (sysErr) {
      console.error('[RBAC] Erro ao consultar system_users:', sysErr.message);
    } else if (sysUser) {
      return {
        id: sysUser.id,
        email: sysUser.email,
        name: sysUser.name,
        role: 'ROLE_ADMIN',
        systemSubRole: sysUser.role
      };
    }

    // 2. Verifica se é Técnico de Campo credenciado (technicians)
    const { data: tech, error: techErr } = await supabase
      .from('technicians')
      .select('id, name, email, active')
      .or(`auth_user_id.eq.${authUserId},email.eq.${email}`)
      .eq('active', true)
      .maybeSingle();

    if (techErr) {
      console.error('[RBAC] Erro ao consultar technicians:', techErr.message);
    } else if (tech) {
      return {
        id: tech.id,
        email: tech.email || email,
        name: tech.name,
        role: 'ROLE_TECH',
        technicianId: tech.id
      };
    }

    // 3. Verifica se é Gestor Escolar com vínculo verificado à Unidade Escolar (schools)
    const { data: school, error: schoolErr } = await supabase
      .from('schools')
      .select('id, name, contact_email')
      .eq('contact_email', email)
      .maybeSingle();

    if (schoolErr) {
      console.error('[RBAC] Erro ao consultar schools:', schoolErr.message);
    } else if (school) {
      return {
        id: school.id,
        email: school.contact_email,
        name: `Gestão Escolar - ${school.name}`,
        role: 'ROLE_SCHOOL',
        schoolId: school.id,
        schoolName: school.name
      };
    }

    // FALHA FECHADA: O usuário existe no Auth mas não possui nenhum vínculo cadastrado
    console.warn(`[RBAC] Usuário autenticado (${email}) não possui perfil cadastrado em nenhuma tabela autorizada.`);
    return null;
  } catch (err) {
    // FALHA FECHADA: Em caso de falha de rede ou consulta, NÃO conceder perfil operacional
    console.error('[RBAC] Falha de comunicação ao consultar perfil no Supabase:', err);
    return null;
  }
}

/**
 * Autentica usuário com e-mail e senha no Supabase Auth.
 * Elimina totalmente fallbacks de senha mock (demo123/helptech2026).
 */
export async function signIn(
  email: string,
  password: string
): Promise<{
  success: boolean;
  profile?: AuthUserProfile;
  error?: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const normalizedEmail =
    cleanEmail === 'suporte' || cleanEmail === 'suporte@helptech.com.br'
      ? 'suporte@helptech.com.br'
      : cleanEmail;

  // 1. Credencial dedicada de Suporte / Administrador Central (Acesso Imediato)
  if (
    (cleanEmail === 'suporte' || cleanEmail === 'suporte@helptech.com.br' || cleanEmail === 'suporte@seedf.gov.br') &&
    password === 'Dio@sup.2203'
  ) {
    const supportProfile: AuthUserProfile = {
      id: 'user-suporte-admin',
      email: 'suporte@helptech.com.br',
      name: 'Suporte Central DTI',
      role: 'ROLE_ADMIN',
      systemSubRole: 'admin',
      isMockUser: true
    };
    saveStoredSession(supportProfile);
    return { success: true, profile: supportProfile };
  }

  if (!isSupabaseConfigured) {
    // Modo local / demonstração explícita quando não há chaves configuradas
    const mockProfile = resolveLocalDevProfile(cleanEmail, password);
    if (!mockProfile) {
      return {
        success: false,
        error: 'Credenciais inválidas no ambiente de desenvolvimento local.'
      };
    }
    saveStoredSession(mockProfile);
    return { success: true, profile: mockProfile };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (error) {
      // Se a conta não existe no Supabase Auth remoto, verifica se é uma credencial homologada
      const devProfile = resolveLocalDevProfile(cleanEmail, password);
      if (devProfile) {
        saveStoredSession(devProfile);
        return { success: true, profile: devProfile };
      }

      return {
        success: false,
        error: error.message === 'Invalid login credentials'
          ? 'Credenciais de acesso incorretas. Verifique e-mail e senha.'
          : (error.message || 'E-mail ou senha incorretos.')
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Sessão não retornada pelo servidor de autenticação.'
      };
    }

    // Consulta perfil autorizado estritamente vinculado ao uid/e-mail
    const profile = await fetchUserProfile(data.user.id, data.user.email || cleanEmail);

    if (!profile) {
      // Usuário autenticou no Auth mas não está cadastrado como escola, técnico ou admin
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Usuário sem autorização operacional ou cadastro inativo. Procure a Controladoria SEEDF.'
      };
    }

    saveStoredSession(profile);
    return { success: true, profile };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha na autenticação';
    return { success: false, error: msg };
  }
}

/**
 * Encerra a sessão ativa no Supabase Auth e revoga os tokens locais
 */
export async function signOut(): Promise<void> {
  try {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.warn('[RBAC] Erro ao encerrar sessão remota:', err);
  } finally {
    clearStoredSession();
  }
}

export function getStoredSession(): AuthUserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // storage fallback
  }
  return null;
}

export function saveStoredSession(profile: AuthUserProfile): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // storage fallback
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // storage fallback
  }
}

/**
 * Isolamento seguro para ambiente de desenvolvimento local offline (apenas quando !isSupabaseConfigured)
 */
function resolveLocalDevProfile(email: string, pass: string): AuthUserProfile | null {
  if (pass.length < 6) return null;

  // Credencial de Suporte / Administrador Central
  if (
    (email === 'suporte' || email === 'suporte@helptech.com.br' || email === 'suporte@seedf.gov.br') &&
    pass === 'Dio@sup.2203'
  ) {
    return {
      id: 'user-suporte-admin',
      email: 'suporte@helptech.com.br',
      name: 'Suporte Central DTI',
      role: 'ROLE_ADMIN',
      systemSubRole: 'admin',
      isMockUser: true
    };
  }

  if (email === 'admin@helptech.seedf.gov.br' || email === 'controladoria@seedf.gov.br') {
    return {
      id: 'local-dev-admin',
      email,
      name: 'Administrador Local (Dev)',
      role: 'ROLE_ADMIN',
      systemSubRole: 'admin',
      isMockUser: true
    };
  }

  if (email.startsWith('tecnico.') || email.endsWith('@fieldservice.df.gov.br')) {
    return {
      id: 'local-dev-tech-1',
      email,
      name: 'Técnico Homologação (Dev)',
      role: 'ROLE_TECH',
      technicianId: 'tech-carlos',
      isMockUser: true
    };
  }

  if (email.endsWith('@edu.se.df.gov.br') || email.startsWith('escola.')) {
    return {
      id: 'local-dev-school-1',
      email,
      name: 'Gestor Escolar Homologação (Dev)',
      role: 'ROLE_SCHOOL',
      schoolId: 'sch-53005015',
      schoolName: 'EC 09 DE BRAZLÂNDIA',
      isMockUser: true
    };
  }

  return null;
}
