import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { callPayex, getPayexUrls } from "../_shared/payex.ts";
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";

type CreateIntentPayload = {
  officialOrderId?: string;
  channel?: "shop" | "delivery";
  returnUrl?: string;
  deliveryContext?: Record<string, unknown>;
};

function parseAllowedOrigins(raw: string | null | undefined) {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function isAllowedReturnUrl(urlText: string) {
  try {
    const url = new URL(urlText);
    const allowlist = parseAllowedOrigins(Deno.env.get("PAYEX_RETURN_URL_ALLOWED_ORIGINS"));
    return allowlist.includes(url.origin);
  } catch {
    return false;
  }
}

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

serve(async (request) => {
  const corsHeaders = buildCorsHeaders(request);
  if (!isCorsAllowed(request)) {
    return new Response(JSON.stringify({ message: "CORS origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
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

  const body = (await request.json()) as CreateIntentPayload;
  if (!body?.officialOrderId || !body?.channel) {
    return new Response(JSON.stringify({ message: "officialOrderId and channel are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (typeof body.returnUrl === "string" && body.returnUrl.trim() && !isAllowedReturnUrl(body.returnUrl)) {
    return new Response(JSON.stringify({ message: "returnUrl origin is not allowed" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const order = await supabase
    .from("official_orders")
    .select("id,channel,currency,total,ship_full_name,ship_phone,ship_address,ship_postcode")
    .eq("id", body.officialOrderId)
    .maybeSingle();
  if (order.error || !order.data?.id) {
    return new Response(JSON.stringify({ message: order.error?.message ?? "Order not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const urls = getPayexUrls(body.channel, body.returnUrl ?? "");
  if (!urls.callbackUrl || !urls.returnUrl) {
    return new Response(JSON.stringify({ message: "Payex callback/return URL is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const returnUrl = new URL(urls.returnUrl);
  returnUrl.searchParams.set("payex_order", order.data.id);
  returnUrl.searchParams.set("payex_channel", body.channel);
  const rawPhone = (order.data.ship_phone ?? "").trim();
  const normalizedPhone = (() => {
    const digits = rawPhone.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("60")) return digits;
    if (digits.startsWith("0")) return `60${digits.slice(1)}`;
    return digits;
  })();
  const amountInCents = Math.max(1, Math.round(Number(order.data.total ?? 0) * 100));
  const basePayload = {
    amount: amountInCents,
    currency: order.data.currency ?? "MYR",
    customer_name: order.data.ship_full_name ?? "NPY Customer",
    contact_number: normalizedPhone || undefined,
    reference_number: order.data.id,
    description: `NPY ${body.channel} order ${order.data.id}`,
    return_url: returnUrl.toString(),
    callback_url: urls.callbackUrl,
    accept_url: returnUrl.toString(),
    reject_url: returnUrl.toString(),
    nonce: order.data.id,
  };
  const payloadCandidates: Array<Record<string, unknown>> = [
    { ...basePayload, payment_types: ["card", "fpx", "ewallet"] },
    { ...basePayload, payment_type: "card" },
    { ...basePayload },
  ];

  let created:
    | { ok: true; data: { key?: string; url?: string; message?: string; error?: string } }
    | { ok: false; message: string }
    | null = null;
  for (const candidate of payloadCandidates) {
    const bodies: unknown[] = [[candidate], candidate];
    for (const bodyPayload of bodies) {
    const attempt = await callPayex<{ key?: string; url?: string; message?: string; error?: string }>({
      method: "POST",
      path: "/api/v1/PaymentIntents",
      body: bodyPayload,
    });
    if (attempt.ok) {
      created = attempt;
      break;
    }
    created = attempt;
    }
    if (created?.ok) break;
  }
  if (!created || !created.ok) {
    return new Response(JSON.stringify({ message: created?.message ?? "Create payment intent failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const resultArray = Array.isArray((created.data as { result?: unknown }).result)
    ? ((created.data as { result: Array<Record<string, unknown>> }).result ?? [])
    : [];
  const firstResult = resultArray[0] ?? null;
  const paymentIntentKey =
    (typeof created.data?.key === "string" ? created.data.key : "") ||
    (typeof firstResult?.key === "string" ? firstResult.key : "");
  const paymentUrl =
    (typeof created.data?.url === "string" ? created.data.url : "") ||
    (typeof firstResult?.url === "string" ? firstResult.url : "");
  if (!paymentIntentKey || !paymentUrl) {
    return new Response(JSON.stringify({ message: "Payex did not return payment URL", payload: created.data }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const paymentInserted = await supabase
    .from("official_payments")
    .insert({
      order_id: order.data.id,
      gateway_ref: paymentIntentKey,
      status: "pending",
      provider: "Payex",
      method: "redirect",
      is_active: true,
      amount: Number(order.data.total ?? 0),
    })
    .select("id")
    .single();
  if (paymentInserted.error || !paymentInserted.data?.id) {
    return new Response(JSON.stringify({ message: paymentInserted.error?.message ?? "Create payment attempt failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const newPaymentId = paymentInserted.data.id;

  await supabase
    .from("official_payments")
    .update({ status: "superseded", is_active: false })
    .eq("order_id", order.data.id)
    .neq("id", newPaymentId)
    .in("status", ["created", "pending"]);

  await supabase
    .from("official_payments")
    .update({ is_active: false })
    .eq("order_id", order.data.id)
    .neq("id", newPaymentId);

  await supabase
    .from("official_orders")
    .update({ active_payment_id: newPaymentId })
    .eq("id", order.data.id);

  if (body.channel === "delivery" && body.deliveryContext) {
    await supabase.from("official_payment_contexts").upsert(
      {
        order_id: order.data.id,
        channel: "delivery",
        context: body.deliveryContext,
        status: "pending",
        processed_at: null,
      },
      { onConflict: "order_id" },
    );
  }

  return new Response(
    JSON.stringify({
      message: "Payex payment intent created",
      data: {
        officialOrderId: order.data.id,
        paymentIntentKey,
        paymentUrl,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
});
