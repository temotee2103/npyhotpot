import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lalamove-signature",
};

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signPayload(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(signature);
}

async function verifySignature(request: Request, rawBody: string) {
  const secret = Deno.env.get("LALAMOVE_WEBHOOK_SECRET") ?? "";
  if (!secret) return { ok: false as const, reason: "missing_secret" };
  const provided = request.headers.get("x-lalamove-signature") ?? "";
  if (!provided) return { ok: false as const, reason: "invalid_signature" };
  const expected = await signPayload(secret, rawBody);
  return {
    ok: provided.toLowerCase() === expected.toLowerCase(),
    reason: provided.toLowerCase() === expected.toLowerCase() ? "verified" : "invalid_signature",
  } as const;
}

function normalizeStatus(rawStatus: string) {
  const status = rawStatus.toUpperCase();
  if (["ASSIGNING_DRIVER", "ON_GOING", "PICKED_UP"].includes(status)) return "in_transit";
  if (["COMPLETED", "DELIVERED"].includes(status)) return "completed";
  if (["CANCELED", "CANCELLED", "FAILED", "EXPIRED"].includes(status)) return "cancelled";
  return null;
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method === "GET" || request.method === "HEAD") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const rawBody = await request.text();
  const verified = await verifySignature(request, rawBody);
  if (!verified.ok) {
    return new Response(JSON.stringify({ message: verified.reason === "missing_secret" ? "Webhook secret not configured" : "Invalid signature" }), {
      status: verified.reason === "missing_secret" ? 500 : 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let body: Record<string, unknown> = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }
  const orderId: string = body?.data?.orderId ?? body?.orderId ?? "";
  const providerStatus: string = body?.data?.status ?? body?.status ?? "UNKNOWN";
  if (!orderId) {
    return new Response(JSON.stringify({ ok: true, message: "Validation accepted" }), {
      status: 200,
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

  const delivery = await supabase.from("official_deliveries").select("id,status").eq("lalamove_order_id", orderId).maybeSingle();
  if (!delivery.data?.id) {
    return new Response(JSON.stringify({ message: "Delivery not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const normalizedStatus = normalizeStatus(providerStatus);
  const nextStatus = normalizedStatus ?? delivery.data.status ?? "requested";
  const updatePayload: Record<string, unknown> = {
    provider_payload: body,
  };
  if (normalizedStatus) {
    updatePayload.status = nextStatus;
  }
  if (nextStatus === "completed" && body?.data?.pod) {
    updatePayload.pod_payload = body.data.pod;
  }
  await supabase.from("official_deliveries").update(updatePayload).eq("id", delivery.data.id);
  await supabase.from("official_delivery_events").insert({
    delivery_id: delivery.data.id,
    step: normalizedStatus ?? "provider_unknown",
    provider_status: providerStatus,
    provider_payload: body,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
