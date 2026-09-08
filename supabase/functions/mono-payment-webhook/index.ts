import {
  createSupabaseAdminClient,
  corsHeaders,
  extractMonoInvoiceId,
  jsonResponse,
  normalizeMonoStatus,
} from "../_shared/mono.ts";

const toNullableString = (value: unknown) => {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
};

const paidOrderWebhookUrl =
  Deno.env.get("N8N_PAID_ORDER_WEBHOOK_URL")?.trim() || "";
const paidOrderWebhookSecret =
  Deno.env.get("N8N_PAID_ORDER_WEBHOOK_SECRET")?.trim() || "";

const notifyPaidOrder = async (order: Record<string, unknown>) => {
  if (!paidOrderWebhookUrl || !paidOrderWebhookSecret) {
    console.warn("Paid-order notification webhook is not configured.");
    return;
  }

  try {
    const response = await fetch(paidOrderWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sharedSecret: paidOrderWebhookSecret, order }),
    });

    if (!response.ok) {
      console.error(
        `Paid-order notification webhook failed with ${response.status}.`,
      );
    }
  } catch (error) {
    console.error(
      `Paid-order notification webhook request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const getNestedRecord = (value: unknown) => {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload || typeof payload !== "object") {
    return jsonResponse({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const invoiceId = extractMonoInvoiceId(payload);
  const merchantPaymInfo = getNestedRecord(payload.merchantPaymInfo);
  const invoiceInfo = getNestedRecord(payload.invoice);
  const reference = toNullableString(
    payload.reference || merchantPaymInfo?.reference,
  );
  const monoStatus = normalizeMonoStatus(
    payload.status || payload.invoiceStatus || invoiceInfo?.status,
  );

  const updateOrder = async (
    column: "mono_invoice_id" | "payment_reference" | "order_number",
    value: string | number,
  ) => {
    const { data: existingOrder, error: existingOrderError } = await admin
      .from("orders")
      .select(
        "id,order_number,status,payment_status,customer_name,customer_phone,city,delivery_method_label,delivery_details,payment_method_label,total_amount,items_summary,comment",
      )
      .eq(column, value)
      .maybeSingle();

    if (existingOrderError || !existingOrder) {
      return { data: null, error: existingOrderError };
    }

    const updates: Record<string, unknown> = {
      payment_status: monoStatus,
      mono_invoice_status: String(
        payload.status || payload.invoiceStatus || "unknown",
      ),
      mono_invoice_payload: payload,
      payment_payload: payload,
    };

    if (monoStatus === "paid") {
      const timestamp = new Date().toISOString();
      updates.status = "paid";
      updates.paid_at = timestamp;
      updates.completed_at = timestamp;
    }

    const { data, error } = await admin
      .from("orders")
      .update(updates)
      .eq("id", existingOrder.id)
      .select(
        "id,order_number,status,payment_status,customer_name,customer_phone,city,delivery_method_label,delivery_details,payment_method_label,total_amount,items_summary,comment",
      )
      .maybeSingle();

    return {
      data,
      error,
      shouldNotify:
        monoStatus === "paid" && existingOrder.payment_status !== "paid",
    };
  };

  let matched = false;
  let paidOrder: Record<string, unknown> | null = null;

  if (invoiceId) {
    const { data, error, shouldNotify } = await updateOrder(
      "mono_invoice_id",
      invoiceId,
    );
    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }
    matched = Boolean(data);
    if (data && shouldNotify) paidOrder = data;
  }

  if (!matched && reference) {
    const { data, error, shouldNotify } = await updateOrder(
      "payment_reference",
      reference,
    );
    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }
    matched = Boolean(data);
    if (data && shouldNotify) paidOrder = data;
  }

  if (!matched && typeof payload.orderNumber !== "undefined") {
    const { data, error, shouldNotify } = await updateOrder(
      "order_number",
      Number(payload.orderNumber),
    );
    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }
    matched = Boolean(data);
    if (data && shouldNotify) paidOrder = data;
  }

  if (!matched) {
    return jsonResponse({ error: "Order not found." }, { status: 404 });
  }

  if (paidOrder) {
    await notifyPaidOrder(paidOrder);
  }

  return jsonResponse({ ok: true });
});
