import {
  createSupabaseAdminClient,
  corsHeaders,
  extractBaseUrl,
  extractSupabaseBaseUrl,
  extractMonoInvoiceId,
  extractMonoPaymentUrl,
  jsonResponse,
} from "../_shared/mono.ts";

type CartItem = {
  id?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  category?: string;
  volumeOption?: string | null;
  volumeLabel?: string | null;
  grindMethod?: string | null;
  grindLabel?: string | null;
};

const monoToken = Deno.env.get("MONO_MERCHANT_TOKEN")?.trim() || "";
const promoDiscountRates: Record<string, number> = {
  barista: 0.1,
  "o.10": 0.1,
  gtavi: 0.06,
};
const isPromoExcludedProduct = (productTitle: string) =>
  /(?:30\s*(drip|дріп)|svarog\s*drip\s*box)/i.test(productTitle);

const getInvoiceAmount = (totalAmount: number) =>
  Math.max(0, Math.round(totalAmount * 100));

const getVolumeLabel = (volumeOption: string) => {
  if (volumeOption === "250g") return "250 г";
  if (volumeOption === "1kg") return "1 кг";
  return "";
};

const getCatalogUnitPrice = (
  catalogItem: Record<string, unknown>,
  priceOverride: Record<string, unknown> | undefined,
  volumeOption: string,
) => {
  const rawData =
    catalogItem.raw_data && typeof catalogItem.raw_data === "object"
      ? (catalogItem.raw_data as Record<string, unknown>)
      : {};
  const volumePrices =
    rawData.volumePrices && typeof rawData.volumePrices === "object"
      ? (rawData.volumePrices as Record<string, unknown>)
      : {};
  const overrideColumn =
    volumeOption === "250g"
      ? "override_price_250g"
      : volumeOption === "1kg"
        ? "override_price_1kg"
        : "";
  const overridePrice = overrideColumn
    ? Number(priceOverride?.[overrideColumn])
    : Number.NaN;
  const configuredPrice = Number(volumePrices[volumeOption]);
  const legacyOverridePrice = Number(priceOverride?.override_price);

  if (Number.isFinite(overridePrice) && overridePrice >= 0)
    return overridePrice;

  const weight = String(catalogItem.weight || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (Number.isFinite(legacyOverridePrice) && legacyOverridePrice >= 0) {
    if (
      volumeOption === "250g" &&
      (weight.includes("1кг") || weight.includes("1kg"))
    ) {
      return Math.round(legacyOverridePrice * 0.25);
    }
    if (
      volumeOption === "1kg" &&
      (weight.includes("250г") || weight.includes("250g"))
    ) {
      return Math.round(legacyOverridePrice * 4);
    }
    return legacyOverridePrice;
  }

  if (Number.isFinite(configuredPrice) && configuredPrice >= 0)
    return configuredPrice;

  const catalogPrice = Number(catalogItem.price);
  const basePrice = Number(catalogItem.base_price);
  const rawPrice = Number(rawData.price);
  const fallbackPrice = [catalogPrice, basePrice, rawPrice].find(
    (price) => Number.isFinite(price) && price > 0,
  );

  if (
    volumeOption === "250g" &&
    (weight.includes("1кг") || weight.includes("1kg"))
  )
    return Math.round((fallbackPrice || 0) * 0.25);
  if (
    volumeOption === "1kg" &&
    (weight.includes("250г") || weight.includes("250g"))
  )
    return Math.round((fallbackPrice || 0) * 4);
  return fallbackPrice || 0;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  if (!monoToken) {
    return jsonResponse(
      { error: "Mono merchant token is not configured." },
      { status: 500 },
    );
  }

  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload || typeof payload !== "object") {
    return jsonResponse({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const paymentMethod = String(payload.paymentMethod || "").trim();
  const cart = Array.isArray(payload.cart) ? (payload.cart as CartItem[]) : [];
  const customerName = String(payload.name || "").trim();
  const customerEmail = String(payload.email || "")
    .trim()
    .toLowerCase();
  const customerPhone = String(payload.phone || "").trim();
  const city = String(payload.city || "").trim() || null;
  const deliveryMethod = String(payload.deliveryMethod || "").trim();
  const deliveryMethodLabel =
    String(payload.deliveryMethodLabel || "").trim() || null;
  const deliveryDetails = String(payload.deliveryDetails || "").trim() || null;
  const paymentMethodLabel =
    String(payload.paymentMethodLabel || "").trim() || "Оплата карткою Mono";
  const comment = String(payload.comment || "").trim() || null;
  const clientRequestId =
    String(
      payload.checkoutRequestId ||
        payload.clientRequestId ||
        payload.requestId ||
        "",
    ).trim() || null;
  const promoCode = String(payload.promoCode || "").trim();
  const promoDiscountRate = promoDiscountRates[promoCode.toLowerCase()] || 0;

  if (paymentMethod !== "mono-card") {
    return jsonResponse(
      { error: "Mono checkout only supports mono-card orders." },
      { status: 400 },
    );
  }

  if (
    !customerName ||
    !customerEmail ||
    !customerPhone ||
    !deliveryMethod ||
    cart.length === 0
  ) {
    return jsonResponse(
      { error: "Missing required checkout fields." },
      { status: 400 },
    );
  }

  try {
    const admin = createSupabaseAdminClient();

    // Guests send no token. A signed-in customer's token links the order to the account and unlocks the loyalty discount.
    const accessToken = (request.headers.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    let customerId: string | null = null;
    let loyaltyDiscountPercent = 0;

    if (accessToken) {
      const { data: userData, error: userError } =
        await admin.auth.getUser(accessToken);

      // Rejecting beats silently charging a price without the discount the cart displayed.
      if (userError || !userData?.user) {
        return jsonResponse(
          {
            error:
              "Сесія входу застаріла. Оновіть сторінку та увійдіть у кабінет ще раз.",
          },
          { status: 401 },
        );
      }

      const userId = userData.user.id;
      const [profileResult, discountStateResult] = await Promise.all([
        admin.from("profiles").select("id").eq("id", userId).maybeSingle(),
        admin
          .from("customer_discount_state")
          .select("current_discount_percent")
          .eq("customer_id", userId)
          .maybeSingle(),
      ]);

      // orders.customer_id references profiles, so only link when the profile row exists.
      if (profileResult.data?.id) {
        customerId = userId;
        const percent = Number(
          discountStateResult.data?.current_discount_percent,
        );
        loyaltyDiscountPercent =
          Number.isFinite(percent) && percent > 0 ? percent : 0;
      }
    }

    const productIds = [
      ...new Set(
        cart
          .map((item) => String(item.id || item.productId || "").trim())
          .filter(Boolean),
      ),
    ];

    const { data: catalogRows, error: catalogError } = await admin
      .from("product_catalog_public")
      .select(
        "product_id,name,category,price,base_price,weight,is_available,availability_status,details",
      )
      .in("product_id", productIds);

    if (catalogError) {
      throw new Error(catalogError.message);
    }

    const catalogMap = new Map<string, any>();
    for (const row of catalogRows ?? []) {
      catalogMap.set(String(row.product_id), row);
    }

    const { data: catalogItemRows, error: catalogItemsError } = await admin
      .from("product_catalog_items")
      .select("product_id,raw_data")
      .in("product_id", productIds);

    if (catalogItemsError) {
      throw new Error(catalogItemsError.message);
    }

    for (const row of catalogItemRows ?? []) {
      const catalogItem = catalogMap.get(String(row.product_id));
      if (catalogItem) catalogItem.raw_data = row.raw_data;
    }

    const { data: priceOverrideRows, error: priceOverridesError } = await admin
      .from("product_price_overrides")
      .select(
        "product_id,override_price,override_price_250g,override_price_1kg",
      )
      .eq("is_active", true)
      .in("product_id", productIds);

    if (priceOverridesError) {
      throw new Error(priceOverridesError.message);
    }

    const priceOverrideMap = new Map<string, Record<string, unknown>>();
    for (const row of priceOverrideRows ?? []) {
      priceOverrideMap.set(String(row.product_id), row);
    }

    const normalizedItems = cart.map((item) => {
      const productId = String(item.id || item.productId || "").trim();
      const catalogItem = catalogMap.get(productId);

      if (!catalogItem) {
        throw new Error(`Unknown product: ${productId}`);
      }

      if (
        catalogItem.is_available === false ||
        catalogItem.availability_status === "out_of_stock"
      ) {
        throw new Error(`Product is unavailable: ${productId}`);
      }

      const requestedQuantity = Number(item.quantity ?? item.qty ?? 1);
      const quantity = Number.isFinite(requestedQuantity)
        ? Math.max(1, Math.trunc(requestedQuantity))
        : 1;
      const volumeOption = String(item.volumeOption || "").trim();

      // Accessories and merch variants: price, stock and name come from the catalog, never from the client.
      let variant: Record<string, unknown> | null = null;
      if (volumeOption.startsWith("variant-")) {
        const variantId = volumeOption.slice("variant-".length);
        const details =
          catalogItem.details && typeof catalogItem.details === "object"
            ? (catalogItem.details as Record<string, unknown>)
            : {};
        const variants = Array.isArray(details.variants)
          ? (details.variants as Record<string, unknown>[])
          : [];
        variant = variants.find((entry) => String(entry.id) === variantId) ?? null;

        if (!variant) {
          throw new Error(`Unknown variant for product: ${productId}`);
        }

        const available = variant.available;
        if (typeof available === "number" && available < quantity) {
          throw new Error(`Variant is unavailable: ${productId}/${variantId}`);
        }
      }

      const variantPrice = variant ? Number(variant.price) : Number.NaN;
      const unitPrice = variant
        ? variant.price !== null &&
          variant.price !== undefined &&
          Number.isFinite(variantPrice)
          ? variantPrice
          : Number(catalogItem.base_price ?? catalogItem.price)
        : getCatalogUnitPrice(
            catalogItem,
            priceOverrideMap.get(productId),
            volumeOption,
          );
      const volumeLabel = variant
        ? String(variant.label || "")
        : getVolumeLabel(volumeOption);
      const productTitle = String(item.name || catalogItem.name || productId);

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error(`Invalid price for product: ${productId}`);
      }

      return {
        product_id: productId,
        product_title: volumeLabel
          ? `${productTitle} (${volumeLabel})`
          : productTitle,
        category: String(item.category || catalogItem.category || ""),
        quantity,
        unit_price: unitPrice,
        grind_method: item.grindMethod ?? null,
        grind_label: item.grindLabel ?? null,
        raw_item: item,
      };
    });

    const computedSubtotal = normalizedItems.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
    const promoEligibleSubtotal = normalizedItems
      .filter((item) => !isPromoExcludedProduct(item.product_title))
      .reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    // Promo and loyalty discounts never stack: the larger one wins. Keep in sync with calculateCartPricing in js/site.js.
    const promoDiscount =
      promoDiscountRate > 0
        ? Math.round(promoEligibleSubtotal * promoDiscountRate)
        : 0;
    const loyaltyDiscount = Math.round(
      promoEligibleSubtotal * (loyaltyDiscountPercent / 100),
    );
    const isLoyaltyApplied = loyaltyDiscount > promoDiscount;
    const safeDiscount = isLoyaltyApplied ? loyaltyDiscount : promoDiscount;
    const appliedDiscountPercent = isLoyaltyApplied
      ? loyaltyDiscountPercent
      : promoDiscount > 0
        ? promoDiscountRate * 100
        : 0;
    const safeTotal = Math.max(0, computedSubtotal - safeDiscount);
    const orderItemsSummary = normalizedItems
      .map((item) => `${item.product_title} x${item.quantity}`)
      .join(", ");
    const baseUrl = extractBaseUrl(request);
    const supabaseBaseUrl = extractSupabaseBaseUrl();
    const returnUrl = String(
      payload.returnUrl || `${baseUrl}/account.html?payment=mono-success`,
    ).trim();

    let existingOrder: {
      id: string;
      order_number: number;
      payment_payload?: Record<string, unknown> | null;
      mono_invoice_payload?: Record<string, unknown> | null;
      payment_reference?: string | null;
      mono_invoice_id?: string | null;
    } | null = null;

    if (clientRequestId) {
      const { data: existingOrderData, error: existingOrderError } = await admin
        .from("orders")
        .select(
          "id, order_number, payment_payload, mono_invoice_payload, payment_reference, mono_invoice_id",
        )
        .eq("client_request_id", clientRequestId)
        .maybeSingle();

      if (existingOrderError) {
        throw existingOrderError;
      }

      if (existingOrderData) {
        existingOrder = existingOrderData as typeof existingOrder;
      }
    }

    let orderId: string;
    let orderNumber: number;

    if (existingOrder) {
      orderId = existingOrder.id;
      orderNumber = Number(existingOrder.order_number);

      const existingPaymentPayload = existingOrder.payment_payload || {};
      const existingMonoInvoicePayload =
        existingOrder.mono_invoice_payload || {};
      const existingPaymentUrl = String(
        (existingPaymentPayload.response as Record<string, unknown> | undefined)
          ?.pageUrl ||
          (existingMonoInvoicePayload as Record<string, unknown>)?.pageUrl ||
          "",
      ).trim();

      if (existingPaymentUrl) {
        return jsonResponse({
          orderId,
          orderNumber,
          invoiceId:
            existingOrder.mono_invoice_id ||
            existingOrder.payment_reference ||
            null,
          paymentUrl: existingPaymentUrl,
          paymentStatus: "pending",
        });
      }
    }

    if (!existingOrder) {
      const { data: order, error: orderError } = await admin
        .from("orders")
        .insert({
          customer_id: customerId,
          source: String(payload.source || "website"),
          status: "new",
          payment_provider: "mono",
          payment_status: "pending",
          client_request_id: clientRequestId,
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
          currency: "UAH",
          subtotal_amount: computedSubtotal,
          discount_percent: appliedDiscountPercent,
          discount_amount: safeDiscount,
          total_amount: safeTotal,
          accumulation_amount: 0,
          items_summary: orderItemsSummary,
          raw_payload: payload,
          payment_gateway: "mono",
        })
        .select("id, order_number")
        .single();

      if (orderError || !order) {
        throw orderError ?? new Error("Failed to create order.");
      }

      orderId = String(order.id);
      orderNumber = Number(order.order_number);

      const { error: orderItemsError } = await admin.from("order_items").insert(
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
    } else {
      const { count: existingOrderItemsCount, error: orderItemsCountError } =
        await admin
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .eq("order_id", orderId);

      if (orderItemsCountError) {
        throw orderItemsCountError;
      }

      if (!existingOrderItemsCount) {
        const { error: orderItemsError } = await admin
          .from("order_items")
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
      }
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

    const monoResponse = await fetch(
      "https://api.monobank.ua/api/merchant/invoice/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Token": monoToken,
        },
        body: JSON.stringify(monoPayload),
      },
    );

    const contentType = monoResponse.headers.get("content-type") || "";
    const monoResult = contentType.includes("application/json")
      ? ((await monoResponse.json().catch(() => ({}))) as Record<
          string,
          unknown
        >)
      : { rawText: await monoResponse.text() };

    const invoiceId = extractMonoInvoiceId(monoResult);
    const paymentUrl = extractMonoPaymentUrl(monoResult);

    if (!monoResponse.ok || !paymentUrl) {
      await admin
        .from("orders")
        .update({
          payment_status: "failed",
          mono_invoice_status: "failed",
          mono_invoice_payload: monoResult,
          payment_payload: {
            request: monoPayload,
            response: monoResult,
          },
        })
        .eq("id", orderId);

      return jsonResponse(
        {
          error: "Failed to create Mono invoice.",
          status: monoResponse.status,
          statusText: monoResponse.statusText,
          details: monoResult,
          request: monoPayload,
        },
        { status: 502 },
      );
    }

    await admin
      .from("orders")
      .update({
        payment_reference: invoiceId || `OCR-${orderNumber}`,
        mono_invoice_id: invoiceId || null,
        mono_invoice_status: String(monoResult.status || "created"),
        mono_invoice_payload: monoResult,
        payment_payload: {
          request: monoPayload,
          response: monoResult,
        },
      })
      .eq("id", orderId);

    return jsonResponse({
      orderId,
      orderNumber,
      invoiceId,
      paymentUrl,
      paymentStatus: "pending",
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Mono invoice.",
        details: error instanceof Error ? error.stack : null,
      },
      { status: 500 },
    );
  }
});
