import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { applyCouponsForCheckout, normalizeCouponCodes } from "../_shared/coupon.ts";
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";

type CheckoutCartItem = {
  id: string;
  quantity: number;
  selectedOptions?: Array<{
    groupId: string;
    optionId: string;
  }>;
  title?: string;
  unitPrice?: number;
};

type CheckoutPayload = {
  action?: "checkout" | "status" | "payment_status";
  currency?: "MYR" | "SGD";
  cartItems?: CheckoutCartItem[];
  shipping?: {
    full_name?: string;
    phone?: string;
    address?: string;
    postcode?: string;
  };
  totals?: {
    subtotal?: number;
    shipping_fee?: number;
    discount_total?: number;
    total?: number;
  };
  officialOrderId?: string;
  quotationId?: string;
  couponCode?: string;
  couponCodes?: string[];
};

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function getUserIdFromBearerToken(request: Request, supabase: ReturnType<typeof getSupabaseAdminClient>) {
  if (!supabase) return null;
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) return null;
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function isActiveAdminUser(supabase: ReturnType<typeof getSupabaseAdminClient>, userId: string) {
  const profile = await supabase.from("official_profiles").select("role,status").eq("id", userId).maybeSingle();
  if (profile.error || !profile.data) return false;
  const role = typeof profile.data.role === "string" ? profile.data.role : "";
  const status = typeof profile.data.status === "string" ? profile.data.status : "";
  return status === "active" && (role === "admin" || role === "super_admin");
}

async function requireOrderAccess(args: { supabase: ReturnType<typeof getSupabaseAdminClient>; userId: string; officialOrderId: string }) {
  const { supabase, userId, officialOrderId } = args;
  const order = await supabase.from("official_orders").select("id,user_id").eq("id", officialOrderId).maybeSingle();
  if (order.error) return { ok: false as const, status: 500 as const, message: order.error.message };
  if (!order.data?.id) return { ok: false as const, status: 404 as const, message: "Order not found" };
  const ownerId = typeof order.data.user_id === "string" ? order.data.user_id : null;
  if (ownerId && ownerId === userId) return { ok: true as const, ownerId };
  const isAdmin = await isActiveAdminUser(supabase, userId);
  if (isAdmin) return { ok: true as const, ownerId };
  return { ok: false as const, status: 403 as const, message: "Forbidden" };
}

function toMoney(value: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(2));
}

serve(async (request) => {
  const corsHeaders = buildCorsHeaders(request);
  if (!isCorsAllowed(request)) {
    return new Response(JSON.stringify({ message: "CORS origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return new Response(JSON.stringify({ message: "Supabase service role not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const body = (await request.json()) as CheckoutPayload;
  const action = body?.action ?? "checkout";
  const userId = await getUserIdFromBearerToken(request, supabase);
  if (!userId) {
    return new Response(JSON.stringify({ message: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (action === "status") {
    if (!body?.officialOrderId) {
      return new Response(JSON.stringify({ message: "officialOrderId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const access = await requireOrderAccess({ supabase, userId, officialOrderId: body.officialOrderId });
    if (!access.ok) {
      return new Response(JSON.stringify({ message: access.message }), {
        status: access.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const delivery = await supabase
      .from("official_deliveries")
      .select("id,lalamove_order_id,status,quotation_expires_at,price_breakdown,distance_meters,created_at")
      .eq("order_id", body.officialOrderId)
      .maybeSingle();

    if (delivery.error) {
      return new Response(JSON.stringify({ message: delivery.error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const events = delivery.data?.id
      ? await supabase
          .from("official_delivery_events")
          .select("id,step,provider_status,created_at")
          .eq("delivery_id", delivery.data.id)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

    if (events.error) {
      return new Response(JSON.stringify({ message: events.error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payment = await supabase
      .from("official_payments")
      .select("id,status,gateway_ref,provider,method,created_at")
      .eq("order_id", body.officialOrderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        message: "Delivery status fetched",
        data: {
          orderId: body.officialOrderId,
          delivery: delivery.data,
          events: events.data ?? [],
          payment: payment.data ?? null,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  if (action === "payment_status") {
    if (!body?.officialOrderId) {
      return new Response(JSON.stringify({ message: "officialOrderId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const access = await requireOrderAccess({ supabase, userId, officialOrderId: body.officialOrderId });
    if (!access.ok) {
      return new Response(JSON.stringify({ message: access.message }), {
        status: access.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const payment = await supabase
      .from("official_payments")
      .select("id,status,gateway_ref,provider,method,created_at")
      .eq("order_id", body.officialOrderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const order = await supabase.from("official_orders").select("id,status,channel,total,currency").eq("id", body.officialOrderId).maybeSingle();
    return new Response(
      JSON.stringify({
        message: "Payment status fetched",
        data: { order: order.data ?? null, payment: payment.data ?? null },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  if (!body?.quotationId) {
    return new Response(JSON.stringify({ message: "quotationId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (!body?.currency || !body?.shipping?.address || !body?.shipping?.full_name || !body?.shipping?.phone) {
    return new Response(JSON.stringify({ message: "Invalid checkout payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const cartItems = (body.cartItems ?? [])
    .map((item) => ({
      id: String(item?.id ?? "").trim(),
      quantity: Math.max(0, Math.floor(Number(item?.quantity ?? 0))),
      selectedOptions: Array.isArray(item?.selectedOptions)
        ? item.selectedOptions
            .map((opt) => ({
              groupId: String(opt?.groupId ?? "").trim(),
              optionId: String(opt?.optionId ?? "").trim(),
            }))
            .filter((opt) => opt.groupId && opt.optionId)
        : [],
    }))
    .filter((item) => item.id && item.quantity > 0);
  if (!cartItems.length) {
    return new Response(JSON.stringify({ message: "Cart is empty" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const quoteRes = await supabase
    .from("official_delivery_quotes")
    .select("quotation_id,user_id,currency,fee,expires_at")
    .eq("quotation_id", body.quotationId)
    .maybeSingle();
  if (quoteRes.error) {
    return new Response(JSON.stringify({ message: quoteRes.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (!quoteRes.data?.quotation_id) {
    return new Response(JSON.stringify({ message: "Invalid quotationId" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const quoteUserId = typeof quoteRes.data.user_id === "string" ? quoteRes.data.user_id : "";
  if (!quoteUserId || quoteUserId !== userId) {
    return new Response(JSON.stringify({ message: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const quoteCurrency = typeof quoteRes.data.currency === "string" ? quoteRes.data.currency : "";
  if (quoteCurrency && quoteCurrency !== body.currency) {
    return new Response(JSON.stringify({ message: "Quote currency mismatch" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const expiresAt = typeof quoteRes.data.expires_at === "string" ? quoteRes.data.expires_at : null;
  if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
    return new Response(JSON.stringify({ message: "Quotation expired" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const itemIds = [...new Set(cartItems.map((item) => item.id))];
  const itemsRes = await supabase.from("official_menu_items").select("id,name,base_price,is_active").in("id", itemIds);
  if (itemsRes.error) {
    return new Response(JSON.stringify({ message: itemsRes.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const itemMap = new Map<string, { id: string; name: string; base_price: number; is_active: boolean }>();
  for (const row of itemsRes.data ?? []) {
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) continue;
    itemMap.set(id, {
      id,
      name: String(row.name ?? "").trim(),
      base_price: Number(row.base_price ?? 0),
      is_active: Boolean(row.is_active),
    });
  }

  const bindingsRes = await supabase
    .from("official_menu_item_option_groups")
    .select("item_id,group_id")
    .in("item_id", itemIds);
  if (bindingsRes.error) {
    return new Response(JSON.stringify({ message: bindingsRes.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const bindingSet = new Set<string>();
  for (const row of bindingsRes.data ?? []) {
    const itemId = typeof row.item_id === "string" ? row.item_id : "";
    const groupId = typeof row.group_id === "string" ? row.group_id : "";
    if (itemId && groupId) bindingSet.add(`${itemId}:${groupId}`);
  }

  const optionIds = [
    ...new Set(
      cartItems.flatMap((item) => item.selectedOptions.map((opt) => opt.optionId)).filter((id) => Boolean(id)),
    ),
  ];
  const optionsRes =
    optionIds.length > 0
      ? await supabase.from("official_menu_option_options").select("id,group_id,name,price_delta").in("id", optionIds)
      : { data: [], error: null };
  if (optionsRes.error) {
    return new Response(JSON.stringify({ message: optionsRes.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const optionMap = new Map<string, { id: string; group_id: string; name: string; price_delta: number }>();
  for (const row of optionsRes.data ?? []) {
    const id = typeof row.id === "string" ? row.id : "";
    const groupId = typeof row.group_id === "string" ? row.group_id : "";
    if (!id || !groupId) continue;
    optionMap.set(id, {
      id,
      group_id: groupId,
      name: String(row.name ?? "").trim(),
      price_delta: Number(row.price_delta ?? 0),
    });
  }

  const computedLines = [];
  for (const cartItem of cartItems) {
    const item = itemMap.get(cartItem.id);
    if (!item || !item.is_active) {
      return new Response(JSON.stringify({ message: "Invalid cart item" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const optionNames: string[] = [];
    let deltaSum = 0;
    for (const selected of cartItem.selectedOptions) {
      if (!bindingSet.has(`${cartItem.id}:${selected.groupId}`)) {
        return new Response(JSON.stringify({ message: "Invalid selected options" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const option = optionMap.get(selected.optionId);
      if (!option || option.group_id !== selected.groupId) {
        return new Response(JSON.stringify({ message: "Invalid selected options" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      optionNames.push(option.name);
      deltaSum += Number(option.price_delta ?? 0);
    }
    const unitPrice = toMoney(Number(item.base_price ?? 0) + deltaSum);
    const title = optionNames.length > 0 ? `${item.name} (${optionNames.join(" / ")})` : item.name;
    computedLines.push({
      item_id: cartItem.id,
      quantity: cartItem.quantity,
      unit_price: unitPrice,
      title,
    });
  }

  const subtotal = toMoney(computedLines.reduce((acc, line) => acc + line.unit_price * line.quantity, 0));
  const requestedCouponCodes = normalizeCouponCodes([...(body.couponCodes ?? []), body.couponCode ?? ""]);

  const outlet = await supabase.from("official_outlets").select("id,name").eq("is_active", true).order("name", { ascending: true }).limit(1).maybeSingle();
  if (outlet.error) {
    return new Response(JSON.stringify({ message: outlet.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const couponApply = await applyCouponsForCheckout({
    supabase: supabase as never,
    couponCodes: requestedCouponCodes,
    userId,
    channel: "delivery",
    currency: body.currency,
    subtotal,
  });
  if (!couponApply.ok) {
    return new Response(JSON.stringify({ message: couponApply.message }), {
      status: couponApply.reason === "not_authenticated" ? 401 : 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const appliedCouponId = couponApply.primaryCouponId;
  const appliedCouponCode = couponApply.primaryCouponCode;
  const discountTotal = couponApply.totalDiscount;
  const checkout = await supabase.rpc("official_checkout_delivery", {
    p_user_id: userId,
    p_currency: body.currency,
    p_items: computedLines.map((line) => ({
      item_id: line.item_id,
      title: line.title,
      quantity: line.quantity,
      unit_price: line.unit_price,
      item_type: "menu_item",
    })),
    p_shipping: {
      full_name: body.shipping.full_name,
      phone: body.shipping.phone,
      postcode: body.shipping.postcode ?? null,
      address: body.shipping.address,
    },
    p_discount_total: discountTotal,
    p_coupon_ids: couponApply.couponIds,
    p_coupon_codes: couponApply.couponCodes,
    p_primary_coupon_id: appliedCouponId,
    p_primary_coupon_code: appliedCouponCode,
    p_quotation_id: body.quotationId,
    p_outlet_id: outlet.data?.id ?? null,
  });

  if (checkout.error) {
    return new Response(JSON.stringify({ message: checkout.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const officialOrderId = typeof checkout.data?.order_id === "string" ? checkout.data.order_id : null;
  const paymentId = typeof checkout.data?.payment_id === "string" ? checkout.data.payment_id : null;
  if (!officialOrderId || !paymentId) {
    return new Response(JSON.stringify({ message: "Checkout failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const paymentAttempt = await supabase
    .from("official_payments")
    .select("id,gateway_ref,status")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentAttempt.error) {
    return new Response(JSON.stringify({ message: paymentAttempt.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(
    JSON.stringify({
      message: "Order created, ready for payment intent",
      data: {
        officialOrderId,
        outletId: outlet.data?.id ?? null,
        outletName: outlet.data?.name ?? "NPY Hotpot Outlet",
        paymentReference: typeof paymentAttempt.data?.gateway_ref === "string" ? paymentAttempt.data.gateway_ref : "",
        paymentStatus: paymentAttempt.data?.status ?? null,
      },
    }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    },
  );
});
