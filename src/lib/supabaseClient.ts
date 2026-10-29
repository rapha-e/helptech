import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export const isSupabaseConfigured = env.isConfigured;

// Cria o cliente somente se as variáveis estiverem presentes; caso contrário instancia dummy seguro para evitar quebras no frontend
export const supabase = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: { persistSession: false }
    });

/**
 * Testa a conexão com o Supabase e checa a existência das tabelas principais
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  tablesFound?: boolean;
}> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      message: 'Supabase não configurado. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.'
    };
  }

  try {
    const { error } = await supabase.from('regional_coordinations').select('id').limit(1);

    if (error) {
      if (error.code === '42P01') {
        return {
          success: true,
          tablesFound: false,
          message: 'Conectado ao Supabase com sucesso! As tabelas ainda precisam ser criadas no SQL Editor.'
        };
      }
      return {
        success: false,
        message: `Erro do Supabase: ${error.message}`
      };
    }

    return {
      success: true,
      tablesFound: true,
      message: 'Conectado ao Supabase! Tabelas e esquema operacional detectados.'
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Falha desconhecida';
    return {
      success: false,
      message: `Erro de rede ou conexão com o endpoint do Supabase: ${errorMessage}`
    };
  }
}
