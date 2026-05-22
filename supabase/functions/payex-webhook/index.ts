import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";
import { verifyPayexSignature } from "../_shared/payex.ts";
import { applyPayexOrderState, parsePayexAuthCodeStatus } from "../_shared/payex-order.ts";

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

serve(async (request) => {
  if (!isCorsAllowed(request)) return new Response("Forbidden", { status: 403 });
  const corsHeaders = buildCorsHeaders(request);
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

  const contentType = request.headers.get("content-type") ?? "";
  const rawText = await request.text();
  let payload: Record<string, unknown> = {};
  if (contentType.includes("application/json")) {
    try {
      payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    } catch {
      payload = {};
    }
  } else {
    const form = new URLSearchParams(rawText);
    payload = Object.fromEntries(form.entries());
  }

  const txnId = typeof payload.txn_id === "string" ? payload.txn_id : "";
  const signature = typeof payload.signature === "string" ? payload.signature : "";
  const verify = await verifyPayexSignature({ txnId, signature });
  if (!verify.ok) {
    return new Response(JSON.stringify({ message: verify.message }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const orderId = typeof payload.reference_number === "string" ? payload.reference_number : "";
  if (!orderId) {
    return new Response(JSON.stringify({ message: "Missing reference_number" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const authCode = typeof payload.auth_code === "string" ? payload.auth_code : "";
  const paymentStatus = parsePayexAuthCodeStatus(authCode) as "succeeded" | "pending" | "failed";
  await applyPayexOrderState(supabase as never, {
    orderId,
    paymentStatus,
    txnId: txnId || null,
    method: typeof payload.payment_type === "string" ? payload.payment_type : null,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
