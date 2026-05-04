import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle';

const runtimeConfig = globalThis.__OCR_CONFIG__ || {};
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const supabaseUrl = String(env.VITE_SUPABASE_URL || runtimeConfig.supabaseUrl || '').trim();
const supabasePublishableKey = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || runtimeConfig.supabasePublishableKey || '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : null;