import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { reconcilePayexOrder } from "../_shared/payex-order.ts";
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";

type StatusPayload = {
  officialOrderId?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildStatusResponse(body: Record<string, unknown>, corsHeaders: HeadersInit, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isUuidLike(value: string) {
  return UUID_PATTERN.test(value.trim());
}

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
  const userId = await getUserIdFromBearerToken(request, supabase);
  if (!userId) {
    return new Response(JSON.stringify({ message: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const body = (await request.json()) as StatusPayload;
  if (!body?.officialOrderId) {
    return new Response(JSON.stringify({ message: "officialOrderId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (!isUuidLike(body.officialOrderId)) {
    return buildStatusResponse(
      {
        message: "Invalid order id",
        invalidOrderId: true,
        data: { order: null, payment: null },
      },
      corsHeaders,
    );
  }

  const access = await requireOrderAccess({ supabase, userId, officialOrderId: body.officialOrderId });
  if (!access.ok) {
    if (access.status === 404) {
      return buildStatusResponse(
        {
          message: access.message,
          notFound: true,
          data: { order: null, payment: null },
        },
        corsHeaders,
      );
    }
    return new Response(JSON.stringify({ message: access.message }), {
      status: access.status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const order = await supabase
    .from("official_orders")
    .select("id,channel,status,total,currency,created_at")
    .eq("id", body.officialOrderId)
    .maybeSingle();
  if (order.error || !order.data?.id) {
    return buildStatusResponse(
      {
        message: order.error?.message ?? "Order not found",
        notFound: true,
        data: { order: null, payment: null },
      },
      corsHeaders,
    );
  }

  const payment = await supabase
    .from("official_payments")
    .select("id,order_id,gateway_ref,status,amount,method,provider,created_at")
    .eq("order_id", body.officialOrderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const localPaymentStatus = String(payment.data?.status ?? "").trim().toLowerCase();
  if (["pending", "created", ""].includes(localPaymentStatus)) {
    await reconcilePayexOrder(supabase as never, body.officialOrderId);
  }

  const refreshedOrder = await supabase
    .from("official_orders")
    .select("id,channel,status,total,currency,created_at")
    .eq("id", body.officialOrderId)
    .maybeSingle();
  const refreshedPayment = await supabase
    .from("official_payments")
    .select("id,order_id,gateway_ref,status,amount,method,provider,created_at")
    .eq("order_id", body.officialOrderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return new Response(
    JSON.stringify({
      message: "Payment status fetched",
      data: {
        order: refreshedOrder.data ?? order.data,
        payment: refreshedPayment.data ?? payment.data ?? null,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
});
