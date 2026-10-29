import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL deve ser uma URL válida').optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(10, 'VITE_SUPABASE_ANON_KEY inválida').optional(),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development')
});

const parsedEnv = envSchema.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV || (import.meta.env.DEV ? 'development' : 'production')
});

if (!parsedEnv.success) {
  console.warn('⚠️ Alerta de Configuração de Ambiente:', parsedEnv.error.format());
}

export const env = {
  supabaseUrl: parsedEnv.success ? parsedEnv.data.VITE_SUPABASE_URL || '' : '',
  supabaseAnonKey: parsedEnv.success ? parsedEnv.data.VITE_SUPABASE_ANON_KEY || '' : '',
  appEnv: parsedEnv.success ? parsedEnv.data.VITE_APP_ENV : 'development',
  isConfigured: Boolean(parsedEnv.success && parsedEnv.data.VITE_SUPABASE_URL && parsedEnv.data.VITE_SUPABASE_ANON_KEY)
};

