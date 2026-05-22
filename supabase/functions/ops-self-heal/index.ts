import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";
import { applyPayexOrderState, reconcilePayexOrder } from "../_shared/payex-order.ts";
import { createDeliveryDispatchRecord, type DeliveryDispatchPayload } from "../_shared/delivery-dispatch.ts";
import { releaseCouponReservations } from "../_shared/coupon.ts";
import { sendOpsAlert } from "../_shared/ops-alert.ts";

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function getRuntimeSetting(supabase: ReturnType<typeof createClient>, key: string) {
  const setting = await supabase.from("official_runtime_settings").select("value").eq("key", key).maybeSingle();
  return String(setting.data?.value ?? "").trim();
}

async function isValidCronSecret(supabase: ReturnType<typeof createClient>, providedSecret: string) {
  if (!providedSecret) return false;
  const expected = await getRuntimeSetting(supabase, "ops_self_heal_cron_secret");
  return Boolean(expected) && expected === providedSecret;
}

function parseIntegerSetting(raw: string, fallback: number) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

serve(async (request) => {
  if (!isCorsAllowed(request)) return new Response("Forbidden", { status: 403 });
  const corsHeaders = buildCorsHeaders(request, ["x-cron-secret"]);
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
    const role = (profile.data?.role as string | undefined) ?? "";
    if (profile.error || !["admin", "super_admin"].includes(role)) {
      return new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    actorUserId = callerId;
    actorRole = role;
  }

  const staleReservationMinutes = parseIntegerSetting(await getRuntimeSetting(supabase, "stale_coupon_reservation_minutes"), 30);
  const paymentHealHours = parseIntegerSetting(await getRuntimeSetting(supabase, "payex_reconcile_pending_hours"), 48);
  const dispatchRetryHours = parseIntegerSetting(await getRuntimeSetting(supabase, "dispatch_retry_hours"), 24);

  let reconciledPayments = 0;
  let repairedDispatches = 0;
  let repairedSettlements = 0;
  let releasedCoupons = 0;
  const issues: Array<{ kind: string; targetId: string; message: string }> = [];

  const paymentSince = new Date(Date.now() - paymentHealHours * 60 * 60 * 1000).toISOString();
  const pendingPayments = await supabase
    .from("official_payments")
    .select("order_id,status,created_at")
    .in("status", ["pending", "created"])
    .eq("is_active", true)
    .gte("created_at", paymentSince)
    .order("created_at", { ascending: false })
    .limit(100);
  if (pendingPayments.error) {
    issues.push({ kind: "payment_reconcile_query", targetId: "official_payments", message: pendingPayments.error.message });
  }

  for (const payment of pendingPayments.data ?? []) {
    const orderId = String(payment.order_id ?? "").trim();
    if (!orderId) continue;
    const repaired = await reconcilePayexOrder(supabase as never, orderId);
    if (!repaired.ok) {
      issues.push({ kind: "payment_reconcile", targetId: orderId, message: repaired.message });
      continue;
    }
    reconciledPayments += 1;
  }

  const unsettledPaidOrders = await supabase
    .from("official_orders")
    .select("id,status,settled_at,created_at")
    .eq("status", "paid")
    .is("settled_at", null)
    .gte("created_at", paymentSince)
    .order("created_at", { ascending: false })
    .limit(100);
  if (unsettledPaidOrders.error) {
    issues.push({ kind: "settlement_repair_query", targetId: "official_orders", message: unsettledPaidOrders.error.message });
  }
  for (const order of unsettledPaidOrders.data ?? []) {
    const orderId = String(order.id ?? "").trim();
    if (!orderId) continue;
    const repaired = await applyPayexOrderState(supabase as never, { orderId, paymentStatus: "succeeded" });
    if (!repaired.ok) {
      issues.push({ kind: "settlement_repair", targetId: orderId, message: repaired.message ?? "settlement repair failed" });
      continue;
    }
    repairedSettlements += 1;
  }

  const dispatchRetrySince = new Date(Date.now() - dispatchRetryHours * 60 * 60 * 1000).toISOString();
  const stuckDeliveryContexts = await supabase
    .from("official_payment_contexts")
    .select("id,order_id,channel,status,context,created_at")
    .eq("channel", "delivery")
    .gte("created_at", dispatchRetrySince)
    .or("status.like.dispatch_failed:%,status.eq.pending")
    .order("created_at", { ascending: false })
    .limit(80);
  if (stuckDeliveryContexts.error) {
    issues.push({
      kind: "dispatch_repair_query",
      targetId: "official_payment_contexts",
      message: stuckDeliveryContexts.error.message,
    });
  }

  for (const context of stuckDeliveryContexts.data ?? []) {
    const orderId = String(context.order_id ?? "").trim();
    if (!orderId) continue;

    const orderRes = await supabase.from("official_orders").select("id,channel,status,active_payment_id").eq("id", orderId).maybeSingle();
    if (!orderRes.data?.id || orderRes.data.channel !== "delivery") continue;

    const activePaymentId = String(orderRes.data.active_payment_id ?? "").trim();
    const paymentRes = activePaymentId
      ? await supabase.from("official_payments").select("status").eq("id", activePaymentId).maybeSingle()
      : await supabase.from("official_payments").select("status").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if ((paymentRes.data?.status ?? "") !== "succeeded") continue;

    const deliveryRes = await supabase.from("official_deliveries").select("id,lalamove_order_id,status").eq("order_id", orderId).maybeSingle();
    if (deliveryRes.data?.id && deliveryRes.data.lalamove_order_id) continue;

    const payload = context.context as DeliveryDispatchPayload;
    if (!payload?.officialOrderId || !payload?.quotationId || !payload?.sender?.stopId || !Array.isArray(payload?.recipients) || payload.recipients.length === 0 || !payload?.dropoffAddress) {
      issues.push({ kind: "dispatch_repair", targetId: orderId, message: "delivery context incomplete" });
      continue;
    }

    const created = await createDeliveryDispatchRecord(supabase as never, payload);
    if (!created.ok) {
      await supabase.from("official_payment_contexts").update({ status: `dispatch_failed:${created.message}` }).eq("id", context.id);
      issues.push({ kind: "dispatch_repair", targetId: orderId, message: created.message });
      continue;
    }
    await supabase.from("official_payment_contexts").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", context.id);
    repairedDispatches += 1;
  }

  const staleReservationBefore = new Date(Date.now() - staleReservationMinutes * 60 * 1000).toISOString();
  const staleCoupons = await supabase
    .from("official_user_coupons")
    .select("id,reserved_order_id")
    .not("reserved_order_id", "is", null)
    .not("reserved_at", "is", null)
    .lte("reserved_at", staleReservationBefore)
    .limit(120);
  if (staleCoupons.error) {
    issues.push({
      kind: "coupon_release_query",
      targetId: "official_user_coupons",
      message: staleCoupons.error.message,
    });
  }

  for (const coupon of staleCoupons.data ?? []) {
    const reservedOrderId = String(coupon.reserved_order_id ?? "").trim();
    if (!reservedOrderId) continue;
    const order = await supabase.from("official_orders").select("id,status").eq("id", reservedOrderId).maybeSingle();
    if (order.error) {
      issues.push({ kind: "coupon_release", targetId: String(coupon.id), message: order.error.message });
      continue;
    }
    const orderStatus = String(order.data?.status ?? "").trim();
    if (order.data?.id && !["created", "payment_failed", "cancelled"].includes(orderStatus)) continue;
    await releaseCouponReservations(supabase as never, [String(coupon.id)], reservedOrderId);
    releasedCoupons += 1;
  }

  const auditStatus = issues.length > 0 ? "partial_success" : "success";
  await supabase.from("official_admin_action_logs").insert({
    actor_user_id: actorUserId,
    actor_role: actorRole,
    action: "ops_self_heal",
    target_type: "system",
    target_id: null,
    channel: "all",
    status: auditStatus,
    detail: {
      invoked_by: cronAuthorized ? "cron" : "admin",
      reconciled_payments: reconciledPayments,
      repaired_dispatches: repairedDispatches,
        repaired_settlements: repairedSettlements,
      released_coupons: releasedCoupons,
      issues_count: issues.length,
      issues_preview: issues.slice(0, 10),
      scanned: {
        pending_payments: pendingPayments.data?.length ?? 0,
          unsettled_paid_orders: unsettledPaidOrders.data?.length ?? 0,
        stuck_delivery_contexts: stuckDeliveryContexts.data?.length ?? 0,
        stale_coupon_reservations: staleCoupons.data?.length ?? 0,
      },
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
      source: "ops-self-heal",
      severity: issues.length >= 5 ? "critical" : "warning",
      title: "Self-heal detected recoverable issues",
      message: `payments=${reconciledPayments}, dispatches=${repairedDispatches}, coupons=${releasedCoupons}, issues=${issues.length}`,
      detail: {
        issues_preview: issues.slice(0, 10),
        invoked_by: cronAuthorized ? "cron" : "admin",
      },
    });

    await supabase.from("official_admin_action_logs").insert({
      actor_user_id: actorUserId,
      actor_role: actorRole,
      action: "ops_alert_dispatch",
      target_type: "system",
      target_id: "ops-self-heal",
      channel: "all",
      status: alertResult.ok ? (alertResult.skipped ? "skipped" : "success") : "failed",
      detail: {
        source_action: "ops_self_heal",
        severity: issues.length >= 5 ? "critical" : "warning",
        alert_message: alertResult.message,
        issues_count: issues.length,
      },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      reconciledPayments,
      repairedDispatches,
      releasedCoupons,
      issues,
      alert: alertResult,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
});
