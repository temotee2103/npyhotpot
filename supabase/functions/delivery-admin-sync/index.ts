import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { callLalamove } from "../_shared/lalamove.ts";
import { sendOpsAlert } from "../_shared/ops-alert.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function isValidCronSecret(supabase: ReturnType<typeof createClient>, providedSecret: string) {
  if (!providedSecret) return false;
  const setting = await supabase.from("official_runtime_settings").select("value").eq("key", "delivery_sync_cron_secret").maybeSingle();
  if (setting.error || !setting.data?.value) return false;
  return String(setting.data.value) === providedSecret;
}

function normalizeStatus(rawStatus: string) {
  const status = rawStatus.toUpperCase();
  if (["ASSIGNING_DRIVER", "ON_GOING", "PICKED_UP"].includes(status)) return "in_transit";
  if (["COMPLETED", "DELIVERED"].includes(status)) return "completed";
  if (["CANCELED", "CANCELLED", "FAILED", "EXPIRED"].includes(status)) return "cancelled";
  return null;
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
  const cronSecret = request.headers.get("x-cron-secret") ?? "";
  const cronAuthorized = await isValidCronSecret(supabase, cronSecret);
  let actorUserId: string | null = null;
  let actorRole: string | null = cronAuthorized ? "system_cron" : null;

  if (!cronAuthorized) {
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
    if (profile.error || !["admin", "super_admin"].includes((profile.data?.role as string | undefined) ?? "")) {
      return new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    actorUserId = callerId;
    actorRole = (profile.data?.role as string | undefined) ?? "admin";
  }

  const body = (await request.json().catch(() => ({}))) as { orderIds?: string[]; syncAllActive?: boolean };
  const orderIds = Array.isArray(body.orderIds) ? body.orderIds.filter(Boolean) : [];

  let deliveriesQuery = supabase
    .from("official_deliveries")
    .select("id,order_id,lalamove_order_id,status,provider_payload")
    .not("lalamove_order_id", "is", null);
  if (orderIds.length > 0) {
    deliveriesQuery = deliveriesQuery.in("order_id", orderIds);
  } else {
    deliveriesQuery = deliveriesQuery.in("status", ["requested", "in_transit"]);
  }

  const deliveriesRes = await deliveriesQuery.limit(200);
  if (deliveriesRes.error) {
    return new Response(JSON.stringify({ message: deliveriesRes.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const deliveries = (deliveriesRes.data ?? []) as Array<{
    id: string;
    order_id: string;
    lalamove_order_id: string | null;
    status: string;
    provider_payload?: { data?: { status?: string } } | null;
  }>;

  let processed = 0;
  let changed = 0;
  const issues: Array<{ orderId: string; message: string }> = [];

  for (const delivery of deliveries) {
    if (!delivery.lalamove_order_id) continue;
    processed += 1;
    const detail = await callLalamove<{ data?: { status?: string } }>({
      method: "GET",
      path: `/v3/orders/${delivery.lalamove_order_id}`,
    });
    if (!detail.ok) {
      issues.push({ orderId: delivery.order_id, message: detail.message });
      continue;
    }
    const providerStatus = String(detail.data?.data?.status ?? "").trim() || "UNKNOWN";
    const normalizedStatus = normalizeStatus(providerStatus);
    const nextStatus = normalizedStatus ?? delivery.status ?? "requested";
    const previousProviderStatus = String(delivery.provider_payload?.data?.status ?? "").trim();
    await supabase
      .from("official_deliveries")
      .update({
        ...(normalizedStatus ? { status: nextStatus } : {}),
        provider_payload: detail.data,
      })
      .eq("id", delivery.id);

    if (delivery.status !== nextStatus || previousProviderStatus !== providerStatus) {
      changed += 1;
      await supabase.from("official_delivery_events").insert({
        delivery_id: delivery.id,
        step: normalizedStatus ?? "provider_unknown",
        provider_status: providerStatus,
        provider_payload: detail.data,
      });
    }
  }

  const auditStatus = issues.length > 0 ? "partial_success" : "success";
  await supabase.from("official_admin_action_logs").insert({
    actor_user_id: actorUserId,
    actor_role: actorRole,
    action: "delivery_status_sync",
    target_type: orderIds.length > 0 ? "delivery_orders_batch" : "delivery_active_queue",
    target_id: orderIds.length > 0 ? orderIds.join(",") : null,
    channel: "delivery",
    status: auditStatus,
    detail: {
      processed,
      changed,
      issues_count: issues.length,
      order_ids: orderIds,
      invoked_by: cronAuthorized ? "cron" : "admin",
    },
  });

  let alertResult:
    | {
        ok: boolean;
        skipped: boolean;
        message: string;
      }
    | null = null;

  if (issues.length > 0) {
    alertResult = await sendOpsAlert(supabase, {
      source: "delivery-admin-sync",
      severity: issues.length >= 5 ? "critical" : "warning",
      title: "Delivery sync encountered provider issues",
      message: `processed=${processed}, changed=${changed}, issues=${issues.length}`,
      detail: {
        order_ids: orderIds,
        issues_preview: issues.slice(0, 10),
        invoked_by: cronAuthorized ? "cron" : "admin",
      },
    });

    await supabase.from("official_admin_action_logs").insert({
      actor_user_id: actorUserId,
      actor_role: actorRole,
      action: "ops_alert_dispatch",
      target_type: "delivery_sync",
      target_id: orderIds.length > 0 ? orderIds.join(",") : "active_queue",
      channel: "delivery",
      status: alertResult.ok ? (alertResult.skipped ? "skipped" : "success") : "failed",
      detail: {
        source_action: "delivery_status_sync",
        severity: issues.length >= 5 ? "critical" : "warning",
        alert_message: alertResult.message,
        issues_count: issues.length,
      },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed,
      changed,
      issues,
      alert: alertResult,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
});
