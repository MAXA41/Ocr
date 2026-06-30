import {
  createSupabaseAdminClient,
  corsHeaders,
  extractBaseUrl,
  extractSupabaseBaseUrl,
  extractMonoInvoiceId,
  extractMonoPaymentUrl,
  jsonResponse,
} from '../_shared/mono.ts';

type CartItem = {
  id?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  price?: number;
  category?: string;
  grindMethod?: string | null;
  grindLabel?: string | null;
};

const monoToken = Deno.env.get('MONO_MERCHANT_TOKEN')?.trim() || '';

const getInvoiceAmount = (totalAmount: number) => Math.max(0, Math.round(totalAmount * 100));

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  if (!monoToken) {
    return jsonResponse({ error: 'Mono merchant token is not configured.' }, { status: 500 });
  }

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload || typeof payload !== 'object') {
    return jsonResponse({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const paymentMethod = String(payload.paymentMethod || '').trim();
  const cart = Array.isArray(payload.cart) ? payload.cart as CartItem[] : [];
  const customerName = String(payload.name || '').trim();
  const customerEmail = String(payload.email || '').trim().toLowerCase();
  const customerPhone = String(payload.phone || '').trim();
  const city = String(payload.city || '').trim() || null;
  const deliveryMethod = String(payload.deliveryMethod || '').trim();
  const deliveryMethodLabel = String(payload.deliveryMethodLabel || '').trim() || null;
  const deliveryDetails = String(payload.deliveryDetails || '').trim() || null;
  const paymentMethodLabel = String(payload.paymentMethodLabel || '').trim() || 'Оплата карткою Mono';
  const comment = String(payload.comment || '').trim() || null;
  const subtotal = Number(payload.subtotal || 0);
  const discountAmount = Math.max(0, Number(payload.discountAmount || 0));
  const total = Math.max(0, Number(payload.total || Math.max(subtotal - discountAmount, 0)));

  if (paymentMethod !== 'mono-card') {
    return jsonResponse({ error: 'Mono checkout only supports mono-card orders.' }, { status: 400 });
  }

  if (!customerName || !customerEmail || !customerPhone || !deliveryMethod || cart.length === 0) {
    return jsonResponse({ error: 'Missing required checkout fields.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const productIds = [...new Set(cart.map((item) => String(item.id || item.productId || '').trim()).filter(Boolean))];

  const { data: catalogRows, error: catalogError } = await admin
    .from('product_catalog_public')
    .select('product_id,name,category,price,is_available,availability_status')
    .in('product_id', productIds);

  if (catalogError) {
    return jsonResponse({ error: catalogError.message }, { status: 500 });
  }

  const catalogMap = new Map<string, any>();
  for (const row of catalogRows ?? []) {
    catalogMap.set(String(row.product_id), row);
  }

  const normalizedItems = cart.map((item) => {
    const productId = String(item.id || item.productId || '').trim();
    const catalogItem = catalogMap.get(productId);

    if (!catalogItem) {
      throw new Error(`Unknown product: ${productId}`);
    }

    if (catalogItem.is_available === false || catalogItem.availability_status === 'out_of_stock') {
      throw new Error(`Product is unavailable: ${productId}`);
    }

    const quantity = Math.max(1, Math.trunc(Number(item.quantity || 1)));
    const unitPrice = Number(catalogItem.price || 0);

    return {
      product_id: productId,
      product_title: String(item.name || catalogItem.name || productId),
      category: String(item.category || catalogItem.category || ''),
      quantity,
      unit_price: unitPrice,
      grind_method: item.grindMethod ?? null,
      grind_label: item.grindLabel ?? null,
      raw_item: item,
    };
  });

  try {
    const computedSubtotal = normalizedItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const safeDiscount = Math.min(discountAmount, computedSubtotal);
    const safeTotal = Math.max(0, total > 0 ? total : computedSubtotal - safeDiscount);
    const orderItemsSummary = normalizedItems
      .map((item) => `${item.product_title} x${item.quantity}`)
      .join(', ');
    const baseUrl = extractBaseUrl(request);
    const supabaseBaseUrl = extractSupabaseBaseUrl();
    const returnUrl = String(payload.returnUrl || `${baseUrl}/account.html?payment=mono-success`).trim();

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        source: String(payload.source || 'website'),
        status: 'new',
        payment_provider: 'mono',
        payment_status: 'pending',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        city,
        delivery_method: deliveryMethod,
        delivery_method_label: deliveryMethodLabel,
        delivery_details: deliveryDetails,
        payment_method: paymentMethod,
        payment_method_label: paymentMethodLabel,
        comment,
        currency: 'UAH',
        subtotal_amount: computedSubtotal,
        discount_percent: 0,
        discount_amount: safeDiscount,
        total_amount: safeTotal,
        accumulation_amount: 0,
        items_summary: orderItemsSummary,
        raw_payload: payload,
        payment_gateway: 'mono',
      })
      .select('id, order_number')
      .single();

    if (orderError || !order) {
      throw orderError ?? new Error('Failed to create order.');
    }

    const orderId = String(order.id);
    const orderNumber = Number(order.order_number);

    const { error: orderItemsError } = await admin
      .from('order_items')
      .insert(
        normalizedItems.map((item) => ({
          order_id: orderId,
          product_id: item.product_id,
          product_title: item.product_title,
          category: item.category,
          quantity: item.quantity,
          unit_price: item.unit_price,
          grind_method: item.grind_method,
          grind_label: item.grind_label,
          raw_item: item.raw_item,
        })),
      );

    if (orderItemsError) {
      throw orderItemsError;
    }

    const monoPayload = {
      amount: getInvoiceAmount(safeTotal),
      ccy: 980,
      merchantPaymInfo: {
        reference: `OCR-${orderNumber}`,
        destination: `Odesa Coffee Roasters order #${orderNumber}`,
        comment: `Order #${orderNumber}`,
        basketOrder: normalizedItems.map((item) => ({
          name: item.product_title,
          qty: item.quantity,
          sum: getInvoiceAmount(item.unit_price * item.quantity),
        })),
      },
      redirectUrl: returnUrl,
      webHookUrl: `${supabaseBaseUrl}/functions/v1/mono-payment-webhook`,
    };

    const monoResponse = await fetch('https://api.monobank.ua/api/merchant/invoice/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Token': monoToken,
      },
      body: JSON.stringify(monoPayload),
    });

    const monoResult = await monoResponse.json().catch(() => ({})) as Record<string, unknown>;
    const invoiceId = extractMonoInvoiceId(monoResult);
    const paymentUrl = extractMonoPaymentUrl(monoResult);

    if (!monoResponse.ok || !paymentUrl) {
      await admin
        .from('orders')
        .update({
          payment_status: 'failed',
          mono_invoice_status: 'failed',
          mono_invoice_payload: monoResult,
          payment_payload: {
            request: monoPayload,
            response: monoResult,
          },
        })
        .eq('id', orderId);

      return jsonResponse(
        {
          error: 'Failed to create Mono invoice.',
          details: monoResult,
        },
        { status: 502 },
      );
    }

    await admin
      .from('orders')
      .update({
        payment_reference: invoiceId || `OCR-${orderNumber}`,
        mono_invoice_id: invoiceId || null,
        mono_invoice_status: String(monoResult.status || 'created'),
        mono_invoice_payload: monoResult,
        payment_payload: {
          request: monoPayload,
          response: monoResult,
        },
      })
      .eq('id', orderId);

    return jsonResponse({
      orderId,
      orderNumber,
      invoiceId,
      paymentUrl,
      paymentStatus: 'pending',
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Failed to create Mono invoice.',
      },
      { status: 400 },
    );
  }
});