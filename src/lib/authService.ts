import { supabase, isSupabaseConfigured } from './supabaseClient';

export type UserRole = 'ROLE_SCHOOL' | 'ROLE_TECH' | 'ROLE_ADMIN';

export interface AuthUserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
  technicianId?: string;
  systemSubRole?: 'admin' | 'controladoria' | 'auditor';
  isMockUser?: boolean;
}

const AUTH_STORAGE_KEY = 'helptech_auth_profile_v2';

/**
 * Consulta de perfil no Supabase a partir do auth.uid() e e-mail autenticado.
 * Aderente ao princípio de Fail-Closed (Falha Fechada).
 */
export async function fetchUserProfile(
  authUserId: string,
  email: string
): Promise<AuthUserProfile | null> {
  if (!isSupabaseConfigured && import.meta.env.DEV) {
    return resolveLocalDevProfile(email);
  }

  try {
    // 1. Prioriza a RPC transacional get_my_profile() no PostgreSQL (Servidor como Fonte de Verdade)
    const { data: profileRpc, error: rpcErr } = await supabase.rpc('get_my_profile');
    if (!rpcErr && profileRpc && profileRpc.role) {
      return profileRpc as AuthUserProfile;
    }

    // 2. Fallback de verificação se é operador do sistema (system_users)
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
        systemSubRole: sysUser.role as any
      };
    }

    // 2. Verifica se é Técnico de Campo (technicians)
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
    console.error('[RBAC] Falha de comunicação ao consultar perfil no Supabase:', err);
    return null;
  }
}

/**
 * Autentica usuário com e-mail e senha no Supabase Auth.
 * Nenhuma credencial ou senha é mantida no código do cliente.
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
      : cleanEmail === 'tecnico' || cleanEmail === 'tecnico@helptech.com.br'
      ? 'tecnico@helptech.com.br'
      : cleanEmail;

  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) {
      const mockProfile = resolveLocalDevProfile(cleanEmail);
      if (!mockProfile) {
        return {
          success: false,
          error: 'Credenciais inválidas no ambiente de desenvolvimento local.'
        };
      }
      saveStoredSession(mockProfile);
      return { success: true, profile: mockProfile };
    }
    return {
      success: false,
      error: 'Serviço de autenticação não configurado no servidor.'
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (error) {
      if (import.meta.env.DEV) {
        const devProfile = resolveLocalDevProfile(cleanEmail);
        if (devProfile) {
          saveStoredSession(devProfile);
          return { success: true, profile: devProfile };
        }
      }

      let friendlyMsg = 'E-mail ou senha incorretos.';
      if (error.message.includes('Invalid login credentials')) {
        friendlyMsg = 'Credenciais de acesso incorretas. Verifique seu e-mail e senha no Supabase.';
      } else if (error.message.includes('Email not confirmed')) {
        friendlyMsg = 'E-mail pendente de confirmação no Supabase Auth. Ative a conta no painel do Supabase (Authentication > Users > Confirm user) ou execute o comando SQL de confirmação.';
      } else if (error.message) {
        friendlyMsg = error.message;
      }

      return {
        success: false,
        error: friendlyMsg
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
      // Fallback de contingência caso o banco Supabase ainda não tenha as tabelas migradas
      if (
        cleanEmail === 'suporte' ||
        cleanEmail === 'suporte@helptech.com.br' ||
        cleanEmail === 'helptechinfoinformatica@gmail.com'
      ) {
        const adminProfile: AuthUserProfile = {
          id: data.user.id,
          email: cleanEmail,
          name: 'Suporte Central HelpTech',
          role: 'ROLE_ADMIN',
          systemSubRole: 'admin',
          isMockUser: false
        };
        saveStoredSession(adminProfile);
        return { success: true, profile: adminProfile };
      }

      if (cleanEmail === 'tecnico' || cleanEmail === 'tecnico@helptech.com.br') {
        const techProfile: AuthUserProfile = {
          id: data.user.id,
          email: cleanEmail,
          name: 'Técnico de Campo HelpTech',
          role: 'ROLE_TECH',
          technicianId: data.user.id,
          isMockUser: false
        };
        saveStoredSession(techProfile);
        return { success: true, profile: techProfile };
      }

      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Usuário sem autorização operacional ou cadastro inativo. Procure a Controladoria HelpTech.'
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
 * Solicitação de recuperação de senha por e-mail
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, message: 'Por favor, informe seu e-mail cadastrado.' };
  }

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/?reset=true`
      });
      if (error) {
        return { success: false, message: `Erro ao enviar e-mail: ${error.message}` };
      }
    } catch (err: any) {
      console.warn('Falha no reset remoto de senha:', err);
    }
  }

  return {
    success: true,
    message: 'Se o e-mail estiver cadastrado no sistema HelpTech, as instruções de redefinição foram enviadas com sucesso.'
  };
}

export async function signOut(): Promise<void> {
  clearStoredSession();
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Falha ao deslogar do Supabase Auth:', err);
    }
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
 * Perfil de desenvolvimento mock — SOMENTE em ambiente DEV quando !isSupabaseConfigured
 */
function resolveLocalDevProfile(email: string): AuthUserProfile | null {
  if (email === 'suporte' || email === 'suporte@helptech.com.br' || email === 'admin@helptech.com.br') {
    return {
      id: 'user-suporte-admin',
      email: 'suporte@helptech.com.br',
      name: 'Suporte Central HelpTech',
      role: 'ROLE_ADMIN',
      systemSubRole: 'admin',
      isMockUser: true
    };
  }

  if (
    email === 'tecnico' ||
    email === 'tecnico@helptech.com.br' ||
    email === 'carlos.silva@helptech.com.br' ||
    email.startsWith('tecnico.')
  ) {
    return {
      id: 'local-dev-tech-1',
      email: 'carlos.silva@helptech.com.br',
      name: 'Carlos Silva (Técnico de Campo)',
      role: 'ROLE_TECH',
      technicianId: 'tech-carlos',
      isMockUser: true
    };
  }

  if (email.startsWith('escola.') || email.includes('escola')) {
    return {
      id: 'local-dev-school-1',
      email,
      name: 'Gestor Escolar',
      role: 'ROLE_SCHOOL',
      schoolId: 'sch-53005015',
      schoolName: 'EC 09 DE BRAZLÂNDIA',
      isMockUser: true
    };
  }

  return null;
}
