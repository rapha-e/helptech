import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fmmlvsoevxhoqpjpberk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_wXU-7x4xKeJRH5akQaxtsQ_uMfBvDBG';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

/**
 * Testa a conexão com o Supabase e checa a existência das tabelas principais
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  tablesFound: boolean;
  message: string;
}> {
  try {
    const { error } = await supabase.from('regional_coordinations').select('id').limit(1);
    if (error) {
      // Código 42P01: tabela não existe no schema public (precisa rodar o schema.sql)
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('not find')) {
        return {
          connected: true,
          tablesFound: false,
          message: 'Conectado ao Supabase com sucesso! As tabelas ainda precisam ser criadas no SQL Editor.'
        };
      }
      return {
        connected: false,
        tablesFound: false,
        message: `Erro do Supabase: ${error.message}`
      };
    }
    return {
      connected: true,
      tablesFound: true,
      message: 'Conectado ao Supabase! Tabelas e esquema operacional detectados.'
    };
  } catch (err: any) {
    return {
      connected: false,
      tablesFound: false,
      message: `Falha na conexão: ${err.message || err}`
    };
  }
}
