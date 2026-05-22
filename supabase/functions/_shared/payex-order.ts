import { createDeliveryDispatchRecord, type DeliveryDispatchPayload } from "./delivery-dispatch.ts";
import { markCouponsRedeemed, releaseCouponReservations } from "./coupon.ts";
import { callPayex } from "./payex.ts";

type SupabaseClientLike = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<unknown>;
};

export function parsePayexAuthCodeStatus(authCode: string) {
  if (authCode === "00") return "succeeded";
  if (authCode === "09") return "pending";
  return "failed";
}

function derivePaymentStatusFromStatusText(statusText: string) {
  const value = statusText.trim().toUpperCase();
  if (!value) return "pending";
  if (["SUCCESS", "SUCCEEDED", "APPROVED", "PAID", "COMPLETED", "CAPTURED"].includes(value)) return "succeeded";
  if (["PENDING", "PROCESSING", "IN_PROGRESS", "AUTHORIZED", "AUTHORISED", "INITIATED"].includes(value)) return "pending";
  if (["FAILED", "DECLINED", "CANCELLED", "CANCELED", "VOIDED", "REJECTED", "EXPIRED"].includes(value)) return "failed";
  return "pending";
}

function collectObjects(node: unknown, bucket: Array<Record<string, unknown>>) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectObjects(item, bucket);
    return;
  }
  if (typeof node !== "object") return;
  const objectNode = node as Record<string, unknown>;
  bucket.push(objectNode);
  for (const value of Object.values(objectNode)) collectObjects(value, bucket);
}

function extractTransactionCandidate(raw: unknown, orderId: string, gatewayRef: string) {
  const objects: Array<Record<string, unknown>> = [];
  collectObjects(raw, objects);

  const normalizedGatewayRef = gatewayRef.trim();
  const directMatch = objects.find((item) => {
    const referenceNumber = String(item.reference_number ?? "").trim();
    const paymentIntentKey = String(item.payment_intent_key ?? item.key ?? "").trim();
    const txnId = String(item.txn_id ?? item.id ?? "").trim();
    return (
      (referenceNumber && referenceNumber === orderId) ||
      (normalizedGatewayRef && paymentIntentKey === normalizedGatewayRef) ||
      (normalizedGatewayRef && txnId === normalizedGatewayRef)
    );
  });

  const candidate = directMatch ?? objects.find((item) => {
    return ["reference_number", "txn_id", "auth_code", "status", "payment_status"].some((key) => key in item);
  });
  if (!candidate) return null;

  const authCode = String(candidate.auth_code ?? "").trim();
  const statusText = String(candidate.payment_status ?? candidate.status ?? "").trim();
  const paymentStatus = authCode ? parsePayexAuthCodeStatus(authCode) : derivePaymentStatusFromStatusText(statusText);
  const txnId = String(candidate.txn_id ?? candidate.id ?? "").trim();
  const method = String(candidate.payment_type ?? candidate.payment_method ?? "").trim() || null;

  return {
    paymentStatus,
    txnId: txnId || null,
    method,
    payload: candidate,
  };
}

export async function fetchPayexTransactionForRepair(orderId: string, gatewayRef: string) {
  const attempts = [
    gatewayRef ? `/api/v1/Transactions/${encodeURIComponent(gatewayRef)}` : null,
    `/api/v1/Transactions?reference_number=${encodeURIComponent(orderId)}`,
    gatewayRef ? `/api/v1/Transactions?payment_intent_key=${encodeURIComponent(gatewayRef)}` : null,
    "/api/v1/Transactions",
  ].filter(Boolean) as string[];

  const seen = new Set<string>();
  for (const path of attempts) {
    if (seen.has(path)) continue;
    seen.add(path);
    const result = await callPayex({ method: "GET", path });
    if (!result.ok) continue;
    const candidate = extractTransactionCandidate(result.data, orderId, gatewayRef);
    if (candidate) return { ok: true as const, data: candidate };
  }
  return { ok: false as const, message: "No matching Payex transaction found" };
}

function mapOrderStatus(paymentStatus: string) {
  if (paymentStatus === "succeeded") return "paid";
  if (paymentStatus === "failed") return "payment_failed";
  return "created";
}

function isTerminalOrderStatus(status: string) {
  return ["completed", "cancelled"].includes(status);
}

function isPaidOrBeyond(status: string) {
  return ["paid", "fulfilling", "completed"].includes(status);
}

function nextOrderStatus(current: string, paymentStatus: "succeeded" | "pending" | "failed") {
  const normalized = current || "created";
  if (isTerminalOrderStatus(normalized)) return normalized;
  if (normalized === "cancelled") return normalized;
  if (paymentStatus === "succeeded") return isPaidOrBeyond(normalized) ? normalized : "paid";
  if (paymentStatus === "failed") return isPaidOrBeyond(normalized) ? normalized : "payment_failed";
  return normalized;
}

function nextPaymentStatus(current: string, incoming: "succeeded" | "pending" | "failed") {
  const normalized = current || "created";
  if (["succeeded", "failed", "superseded"].includes(normalized)) return normalized;
  if (incoming === "succeeded") return "succeeded";
  if (incoming === "failed") return "failed";
  return "pending";
}

async function resolvePayexPaymentAttempt(
  supabase: SupabaseClientLike,
  args: { orderId: string; activePaymentId?: string | null; paymentId?: string | null; txnId?: string | null },
) {
  const maybeFetchById = async (id: string) => {
    const result = await supabase
      .from("official_payments")
      .select("id,order_id,status,gateway_ref,txn_id,method,created_at")
      .eq("id", id)
      .maybeSingle();
    const row = result?.data as Record<string, unknown> | null | undefined;
    if (!row?.id) return null;
    if (String(row.order_id ?? "") !== args.orderId) return null;
    return row;
  };

  if (args.paymentId) {
    const row = await maybeFetchById(args.paymentId);
    if (row) return row;
  }

  const normalizedTxnId = String(args.txnId ?? "").trim();
  if (normalizedTxnId) {
    const byTxn = await supabase
      .from("official_payments")
      .select("id,order_id,status,gateway_ref,txn_id,method,created_at")
      .eq("txn_id", normalizedTxnId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const txnRow = byTxn?.data as Record<string, unknown> | null | undefined;
    if (txnRow?.id && String(txnRow.order_id ?? "") === args.orderId) return txnRow;

    const byLegacy = await supabase
      .from("official_payments")
      .select("id,order_id,status,gateway_ref,txn_id,method,created_at")
      .eq("gateway_ref", normalizedTxnId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const legacyRow = byLegacy?.data as Record<string, unknown> | null | undefined;
    if (legacyRow?.id && String(legacyRow.order_id ?? "") === args.orderId) return legacyRow;
  }

  const normalizedActiveId = String(args.activePaymentId ?? "").trim();
  if (normalizedActiveId) {
    const row = await maybeFetchById(normalizedActiveId);
    if (row) return row;
  }

  const latest = await supabase
    .from("official_payments")
    .select("id,order_id,status,gateway_ref,txn_id,method,created_at")
    .eq("order_id", args.orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (latest?.data as Record<string, unknown> | null | undefined) ?? null;
}

export async function applyPayexOrderState(
  supabase: SupabaseClientLike,
  args: {
    orderId: string;
    paymentStatus: "succeeded" | "pending" | "failed";
    txnId?: string | null;
    method?: string | null;
    paymentId?: string | null;
  },
) {
  const nowIso = new Date().toISOString();
  const orderResult = await supabase
    .from("official_orders")
    .select("id,status,user_id,channel,total,outlet_id,active_payment_id,paid_at,settled_at,user_coupon_id,user_coupon_ids")
    .eq("id", args.orderId)
    .maybeSingle();
  const orderRow = (orderResult?.data as Record<string, unknown> | null | undefined) ?? null;
  if (!orderRow?.id) return { ok: false as const, message: "Order not found" };

  const paymentRow = await resolvePayexPaymentAttempt(supabase, {
    orderId: args.orderId,
    activePaymentId: (orderRow.active_payment_id as string | null | undefined) ?? null,
    paymentId: args.paymentId ?? null,
    txnId: args.txnId ?? null,
  });

  if (paymentRow?.id) {
    const currentStatus = String(paymentRow.status ?? "created");
    const desiredStatus = nextPaymentStatus(currentStatus, args.paymentStatus);
    const update: Record<string, unknown> = { provider: "Payex" };
    if (desiredStatus !== currentStatus) update.status = desiredStatus;
    if (args.txnId && !String(paymentRow.txn_id ?? "").trim()) update.txn_id = args.txnId;
    if (args.method !== undefined) update.method = args.method ?? null;
    if (Object.keys(update).length > 0) {
      await supabase.from("official_payments").update(update).eq("id", paymentRow.id);
    }
  }

  const currentOrderStatus = String(orderRow.status ?? "created") || "created";
  const desiredOrderStatus = nextOrderStatus(currentOrderStatus, args.paymentStatus);
  const orderUpdate: Record<string, unknown> = {};
  if (desiredOrderStatus !== currentOrderStatus) orderUpdate.status = desiredOrderStatus;
  if (args.paymentStatus === "succeeded" && !String(orderRow.paid_at ?? "").trim()) orderUpdate.paid_at = nowIso;
  if (Object.keys(orderUpdate).length > 0) {
    await supabase.from("official_orders").update(orderUpdate).eq("id", args.orderId);
  }

  if (args.paymentStatus === "succeeded") {
    if (String(orderRow.settled_at ?? "").trim()) {
      return { ok: true as const, paymentStatus: args.paymentStatus };
    }

    const orderId = String(orderRow.id);
    const userId = (orderRow.user_id as string | null | undefined) ?? null;
    const channel = String(orderRow.channel ?? "shop") as "shop" | "delivery";
    const outletId = (orderRow.outlet_id as string | null | undefined) ?? null;
    const total = Number(orderRow.total ?? 0);

    if (userId) {
      await supabase.rpc("official_bind_referral_from_user_metadata", { p_user_id: userId });
      await supabase.rpc("official_post_points_for_consumption", {
        p_consumer_user_id: userId,
        p_spend_amount: total,
        p_source_type: "order_paid",
        p_source_id: orderId,
        p_channel: channel ?? "all",
        p_event_at: nowIso,
      });
    }

    const couponIds = Array.from(
      new Set([
        ...(Array.isArray(orderRow.user_coupon_ids) ? (orderRow.user_coupon_ids as string[]) : []),
        ...((orderRow.user_coupon_id as string | null | undefined) ? [orderRow.user_coupon_id as string] : []),
      ]),
    );
    if (couponIds.length > 0) {
      await markCouponsRedeemed(supabase as never, {
        couponIds,
        channel,
        orderId,
        redeemedBy: userId,
        outletId,
      });
    }

    const context = await supabase
      .from("official_payment_contexts")
      .select("id,channel,status,context")
      .eq("order_id", args.orderId)
      .maybeSingle();
    if (context.data?.id && context.data.channel === "delivery" && context.data.status !== "processed") {
      const dispatchBody = context.data.context as DeliveryDispatchPayload;
      const dispatch = await createDeliveryDispatchRecord(supabase as never, dispatchBody);
      if (!dispatch.ok) {
        await supabase
          .from("official_payment_contexts")
          .update({ status: `dispatch_failed:${dispatch.message}` })
          .eq("id", context.data.id);
      } else {
        await supabase.from("official_payment_contexts").update({ status: "processed", processed_at: nowIso }).eq("id", context.data.id);
      }
    }

    await supabase
      .from("official_orders")
      .update({ settled_at: nowIso })
      .eq("id", args.orderId)
      .is("settled_at", null)
      .select("id")
      .maybeSingle();

    return { ok: true as const, paymentStatus: args.paymentStatus };
  }

  if (args.paymentStatus === "failed" && !isPaidOrBeyond(desiredOrderStatus) && !isTerminalOrderStatus(desiredOrderStatus)) {
    const couponIds = Array.from(
      new Set([
        ...(Array.isArray(orderRow.user_coupon_ids) ? (orderRow.user_coupon_ids as string[]) : []),
        ...((orderRow.user_coupon_id as string | null | undefined) ? [orderRow.user_coupon_id as string] : []),
      ]),
    );
    if (couponIds.length > 0) {
      await releaseCouponReservations(supabase as never, couponIds, String(orderRow.id));
    }
  }

  return { ok: true as const, paymentStatus: args.paymentStatus };
}

export async function reconcilePayexOrder(supabase: SupabaseClientLike, orderId: string) {
  const order = await supabase.from("official_orders").select("id,active_payment_id").eq("id", orderId).maybeSingle();
  const activePaymentId = String(order.data?.active_payment_id ?? "").trim();
  const payment = activePaymentId
    ? await supabase
        .from("official_payments")
        .select("id,gateway_ref,status,method,txn_id,created_at")
        .eq("id", activePaymentId)
        .maybeSingle()
    : await supabase
        .from("official_payments")
        .select("id,gateway_ref,status,method,txn_id,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  const paymentId = String(payment.data?.id ?? "").trim() || null;
  const gatewayRef = String(payment.data?.gateway_ref ?? "").trim();
  const remote = await fetchPayexTransactionForRepair(orderId, gatewayRef);
  if (!remote.ok) return remote;

  await applyPayexOrderState(supabase, {
    orderId,
    paymentId,
    paymentStatus: remote.data.paymentStatus as "succeeded" | "pending" | "failed",
    txnId: remote.data.txnId,
    method: remote.data.method ?? payment.data?.method ?? null,
  });

  return {
    ok: true as const,
    data: {
      paymentId,
      paymentStatus: remote.data.paymentStatus,
      txnId: remote.data.txnId,
      method: remote.data.method ?? payment.data?.method ?? null,
      payload: remote.data.payload,
    },
  };
}
