import {
  createSupabaseAdminClient,
  corsHeaders,
  extractMonoInvoiceId,
  jsonResponse,
  normalizeMonoStatus,
} from '../_shared/mono.ts';

const toNullableString = (value: unknown) => {
  const text = String(value || '').trim();
  return text.length > 0 ? text : null;
};

const getNestedRecord = (value: unknown) => {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload || typeof payload !== 'object') {
    return jsonResponse({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const invoiceId = extractMonoInvoiceId(payload);
  const merchantPaymInfo = getNestedRecord(payload.merchantPaymInfo);
  const invoiceInfo = getNestedRecord(payload.invoice);
  const reference = toNullableString(payload.reference || merchantPaymInfo?.reference);
  const monoStatus = normalizeMonoStatus(payload.status || payload.invoiceStatus || invoiceInfo?.status);

  const updateOrder = async (column: 'mono_invoice_id' | 'payment_reference' | 'order_number', value: string | number) => {
    const updates: Record<string, unknown> = {
      payment_status: monoStatus,
      mono_invoice_status: String(payload.status || payload.invoiceStatus || 'unknown'),
      mono_invoice_payload: payload,
      payment_payload: payload,
    };

    if (monoStatus === 'paid') {
      const timestamp = new Date().toISOString();
      updates.status = 'paid';
      updates.paid_at = timestamp;
      updates.completed_at = timestamp;
    }

    return admin.from('orders').update(updates).eq(column, value).select('id, order_number').maybeSingle();
  };

  let matched = false;

  if (invoiceId) {
    const { data, error } = await updateOrder('mono_invoice_id', invoiceId);
    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }
    matched = Boolean(data);
  }

  if (!matched && reference) {
    const { data, error } = await updateOrder('payment_reference', reference);
    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }
    matched = Boolean(data);
  }

  if (!matched && typeof payload.orderNumber !== 'undefined') {
    const { data, error } = await updateOrder('order_number', Number(payload.orderNumber));
    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }
    matched = Boolean(data);
  }

  if (!matched) {
    return jsonResponse({ error: 'Order not found.' }, { status: 404 });
  }

  return jsonResponse({ ok: true });
});