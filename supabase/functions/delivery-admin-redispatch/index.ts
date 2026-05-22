import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createDeliveryDispatchRecord } from "../_shared/delivery-dispatch.ts";
import { callLalamove } from "../_shared/lalamove.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PICKUP_POINT = {
  address: "3, Jalan Mawar, Seksyen 10, Taman Perindustrian Bukit Serdang, 43300 Seri Kembangan, Selangor, Malaysia",
  coordinates: { lat: 3.0407659, lng: 101.6992641 },
  senderName: "NPY Hotpot",
  senderPhone: "+60198433519",
};

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function geocodeAddress(address: string) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&countrycodes=my&limit=1&addressdetails=1&q=${encodeURIComponent(`${address}, Malaysia`)}`,
  );
  if (!response.ok) return null;
  const list = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  const first = list[0];
  const lat = Number(first?.lat ?? NaN);
  const lng = Number(first?.lon ?? NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const caller = await supabase.auth.getUser(token);
  const callerId = caller.data.user?.id ?? "";
  if (caller.error || !callerId) {
    return new Response(JSON.stringify({ message: caller.error?.message ?? "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const profile = await supabase.from("official_profiles").select("role").eq("id", callerId).maybeSingle();
  const actorRole = (profile.data?.role as string | undefined) ?? null;
  if (profile.error || !["admin", "super_admin"].includes(actorRole ?? "")) {
    return new Response(JSON.stringify({ message: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const body = (await request.json().catch(() => ({}))) as { officialOrderId?: string };
  const officialOrderId = String(body.officialOrderId ?? "").trim();
  if (!officialOrderId) {
    return new Response(JSON.stringify({ message: "officialOrderId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const [orderRes, paymentRes, deliveryRes, contextRes] = await Promise.all([
    supabase.from("official_orders").select("id,channel,ship_full_name,ship_phone,ship_address,outlet_id").eq("id", officialOrderId).maybeSingle(),
    supabase.from("official_payments").select("status").eq("order_id", officialOrderId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("official_deliveries").select("id,status,quotation_id,quotation_expires_at,pickup_outlet_id").eq("order_id", officialOrderId).maybeSingle(),
    supabase.from("official_payment_contexts").select("context").eq("order_id", officialOrderId).maybeSingle(),
  ]);

  if (orderRes.error || !orderRes.data || orderRes.data.channel !== "delivery") {
    return new Response(JSON.stringify({ message: "Delivery order not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if ((paymentRes.data?.status ?? "") !== "succeeded") {
    return new Response(JSON.stringify({ message: "订单尚未支付成功，不能重派" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const currentStatus = String(deliveryRes.data?.status ?? "not_created");
  if (!["not_created", "cancelled"].includes(currentStatus)) {
    return new Response(JSON.stringify({ message: `当前配送状态为 ${currentStatus}，不允许人工重派` }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const deliveryContext = (contextRes.data?.context ?? {}) as Record<string, unknown>;
  const existingQuotationId = String(deliveryContext.quotationId ?? deliveryRes.data?.quotation_id ?? "").trim();
  const quotationExpiresAt = String(deliveryContext.quotationExpiresAt ?? deliveryRes.data?.quotation_expires_at ?? "").trim();
  const quotationStillValid = quotationExpiresAt ? new Date(quotationExpiresAt).getTime() > Date.now() + 15_000 : false;
  const serviceType = String(deliveryContext.serviceType ?? "MOTORCYCLE");
  let quotationId = existingQuotationId;
  let nextQuotationExpiresAt = quotationExpiresAt || null;
  let nextDistanceMeters = Number(deliveryContext.distanceMeters ?? 0) || null;
  let nextPriceBreakdown = deliveryContext.priceBreakdown ?? null;
  let pickupStopId = String((deliveryContext.sender as { stopId?: string } | undefined)?.stopId ?? "").trim();
  let dropoffStopId = String((deliveryContext.recipients as Array<{ stopId?: string }> | undefined)?.[0]?.stopId ?? "").trim();
  let resolvedDropoffCoordinates =
    Number.isFinite((deliveryContext.dropoffCoordinates as { lat?: number; lng?: number } | undefined)?.lat) &&
    Number.isFinite((deliveryContext.dropoffCoordinates as { lat?: number; lng?: number } | undefined)?.lng)
      ? {
          lat: Number((deliveryContext.dropoffCoordinates as { lat?: number; lng?: number }).lat),
          lng: Number((deliveryContext.dropoffCoordinates as { lat?: number; lng?: number }).lng),
        }
      : null;

  if (!quotationId || !quotationStillValid || !pickupStopId || !dropoffStopId) {
    resolvedDropoffCoordinates = resolvedDropoffCoordinates ?? (await geocodeAddress(String(orderRes.data.ship_address ?? "")));
    if (!resolvedDropoffCoordinates) {
      return new Response(JSON.stringify({ message: "无法解析收件地址，暂时不能自动重派" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const quote = await callLalamove<{
      data?: {
        quotationId?: string;
        expiresAt?: string;
        distance?: { value?: number };
        priceBreakdown?: unknown;
        stops?: Array<{ stopId?: string }>;
      };
    }>({
      method: "POST",
      path: "/v3/quotations",
      body: {
        data: {
          serviceType,
          language: "en_MY",
          stops: [
            {
              address: PICKUP_POINT.address,
              coordinates: {
                lat: String(PICKUP_POINT.coordinates.lat),
                lng: String(PICKUP_POINT.coordinates.lng),
              },
            },
            {
              address: String(orderRes.data.ship_address ?? ""),
              coordinates: {
                lat: String(resolvedDropoffCoordinates.lat),
                lng: String(resolvedDropoffCoordinates.lng),
              },
            },
          ],
        },
      },
    });
    if (!quote.ok) {
      return new Response(JSON.stringify({ message: `重新报价失败：${quote.message}` }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    quotationId = String(quote.data?.data?.quotationId ?? "").trim();
    nextQuotationExpiresAt = String(quote.data?.data?.expiresAt ?? "").trim() || null;
    nextDistanceMeters = Number(quote.data?.data?.distance?.value ?? 0) || null;
    nextPriceBreakdown = quote.data?.data?.priceBreakdown ?? null;
    pickupStopId = String(quote.data?.data?.stops?.[0]?.stopId ?? "").trim();
    dropoffStopId = String(quote.data?.data?.stops?.[1]?.stopId ?? "").trim();
    if (!quotationId || !pickupStopId || !dropoffStopId) {
      return new Response(JSON.stringify({ message: "Lalamove 重新报价未返回可用 quotation" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  const sender = {
    stopId: pickupStopId,
    name: PICKUP_POINT.senderName,
    phone: PICKUP_POINT.senderPhone,
  };
  const recipientPhone = String(orderRes.data.ship_phone ?? "").trim();
  const recipients = [
    {
      stopId: dropoffStopId,
      name: String(orderRes.data.ship_full_name ?? "Customer"),
      phone: recipientPhone,
    },
  ];
  const nextContext = {
    ...deliveryContext,
    serviceType,
    quotationId,
    quotationExpiresAt: nextQuotationExpiresAt,
    distanceMeters: nextDistanceMeters,
    priceBreakdown: nextPriceBreakdown,
    sender,
    recipients,
    dropoffAddress: String(orderRes.data.ship_address ?? ""),
    dropoffCoordinates: resolvedDropoffCoordinates,
    pickupOutletId: (orderRes.data.outlet_id as string | null) ?? null,
  };

  await supabase.from("official_payment_contexts").update({ context: nextContext }).eq("order_id", officialOrderId);

  if (!deliveryRes.data?.id) {
    const created = await createDeliveryDispatchRecord(supabase as never, {
      officialOrderId,
      quotationId,
      sender,
      recipients,
      remarks: String(deliveryContext.remarks ?? "manual-redispatch"),
      metadata: (deliveryContext.metadata as Record<string, string> | undefined) ?? {},
      dropoffAddress: String(orderRes.data.ship_address ?? ""),
      pickupOutletId: (orderRes.data.outlet_id as string | null) ?? null,
      quotationExpiresAt: nextQuotationExpiresAt,
      distanceMeters: nextDistanceMeters,
      priceBreakdown: nextPriceBreakdown,
    });
    if (!created.ok) {
      await supabase.from("official_admin_action_logs").insert({
        actor_user_id: callerId,
        actor_role: actorRole,
        action: "delivery_redispatch",
        target_type: "official_order",
        target_id: officialOrderId,
        channel: "delivery",
        status: "failed",
        detail: {
          mode: "create_dispatch_record",
          message: created.message,
        },
      });
      return new Response(JSON.stringify({ message: created.message }), {
        status: created.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    await supabase.from("official_admin_action_logs").insert({
      actor_user_id: callerId,
      actor_role: actorRole,
      action: "delivery_redispatch",
      target_type: "official_order",
      target_id: officialOrderId,
      channel: "delivery",
      status: "success",
      detail: {
        mode: "create_dispatch_record",
        quotation_id: quotationId,
      },
    });
    return new Response(JSON.stringify({ ok: true, mode: "created", data: created.data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const created = await callLalamove<{ data?: { orderId?: string } }>({
    method: "POST",
    path: "/v3/orders",
    body: {
      data: {
        quotationId,
        sender,
        recipients: recipients.map((recipient) => ({
          ...recipient,
          remarks: String(deliveryContext.remarks ?? "manual-redispatch"),
        })),
        metadata: (deliveryContext.metadata as Record<string, string> | undefined) ?? {},
      },
    },
  });
  if (!created.ok) {
    await supabase.from("official_admin_action_logs").insert({
      actor_user_id: callerId,
      actor_role: actorRole,
      action: "delivery_redispatch",
      target_type: "official_order",
      target_id: officialOrderId,
      channel: "delivery",
      status: "failed",
      detail: {
        mode: "redispatch_existing_delivery",
        message: created.message,
      },
    });
    return new Response(JSON.stringify({ message: `重新派单失败：${created.message}` }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const providerOrderId = String(created.data?.data?.orderId ?? "").trim();
  if (!providerOrderId) {
    return new Response(JSON.stringify({ message: "Lalamove 未返回新的订单号" }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  await supabase
    .from("official_deliveries")
    .update({
      lalamove_order_id: providerOrderId,
      status: "requested",
      provider_payload: created.data,
      quotation_id: quotationId,
      quotation_expires_at: nextQuotationExpiresAt,
      price_breakdown: nextPriceBreakdown,
      distance_meters: nextDistanceMeters,
      dropoff_address: String(orderRes.data.ship_address ?? ""),
      pickup_outlet_id: (orderRes.data.outlet_id as string | null) ?? null,
    })
    .eq("id", deliveryRes.data.id);

  await supabase.from("official_delivery_events").insert({
    delivery_id: deliveryRes.data.id,
    step: "requested",
    provider_status: "ORDER_REDISPATCHED",
    provider_payload: created.data,
  });
  await supabase.from("official_admin_action_logs").insert({
    actor_user_id: callerId,
    actor_role: actorRole,
    action: "delivery_redispatch",
    target_type: "official_order",
    target_id: officialOrderId,
    channel: "delivery",
    status: "success",
    detail: {
      mode: "redispatch_existing_delivery",
      quotation_id: quotationId,
      lalamove_order_id: providerOrderId,
    },
  });

  return new Response(JSON.stringify({ ok: true, mode: "redispatched", lalamoveOrderId: providerOrderId }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
