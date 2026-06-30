import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const jsonResponse = (body: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
};

const getFirstEnv = (...names: string[]) => {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) {
      return value;
    }
  }

  return '';
};

export const createSupabaseAdminClient = () => {
  const supabaseUrl = getFirstEnv('SUPABASE_URL', 'SB_URL', 'PROJECT_URL');
  const supabaseServiceRoleKey = getFirstEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'SB_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase service credentials are not configured.');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const extractBaseUrl = (request: Request) => {
  const origin = request.headers.get('origin')?.trim() || getFirstEnv('PUBLIC_SITE_URL', 'SITE_URL');

  if (origin) {
    return origin.replace(/\/$/, '');
  }

  const supabaseUrl = getFirstEnv('SUPABASE_URL', 'SB_URL', 'PROJECT_URL');
  return supabaseUrl.replace(/\/$/, '');
};

export const extractSupabaseBaseUrl = () => {
  const supabaseUrl = getFirstEnv('SUPABASE_URL', 'SB_URL', 'PROJECT_URL');
  return supabaseUrl.replace(/\/$/, '');
};

export const normalizeMonoStatus = (value: unknown) => {
  const status = String(value || '').trim().toLowerCase();

  if (['success', 'paid', 'done', 'completed', 'confirmed'].includes(status)) {
    return 'paid';
  }

  if (['failed', 'declined', 'error', 'rejected'].includes(status)) {
    return 'failed';
  }

  if (['expired'].includes(status)) {
    return 'expired';
  }

  if (['canceled', 'cancelled', 'void'].includes(status)) {
    return 'canceled';
  }

  return 'pending';
};

export const extractMonoInvoiceId = (payload: Record<string, unknown>) => {
  return String(payload.invoiceId || payload.invoice_id || payload.id || payload.invoice?.id || '').trim();
};

export const extractMonoPaymentUrl = (payload: Record<string, unknown>) => {
  return String(payload.pageUrl || payload.paymentUrl || payload.url || '').trim();
};