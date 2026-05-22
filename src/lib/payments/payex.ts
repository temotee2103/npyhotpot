import { supabase } from "@/lib/supabase";

type CreateIntentArgs = {
  officialOrderId: string;
  channel: "shop" | "delivery";
  returnUrl: string;
  deliveryContext?: Record<string, unknown>;
};

type PayexPaymentStatusReason = "invalid_order_id" | "order_not_found";

type PayexPaymentStatusPayload = {
  message?: string;
  data?: unknown;
  invalidOrderId?: boolean;
  notFound?: boolean;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidLike(value: string) {
  return UUID_PATTERN.test(value.trim());
}

function buildPaymentStatusFailure(message: string, reason?: PayexPaymentStatusReason) {
  return {
    ok: false as const,
    message,
    ...(reason ? { reason } : {}),
  };
}

async function resolveFunctionErrorMessage(error: unknown, fallback: string) {
  const messageFromError =
    error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  const context = error && typeof error === "object" && "context" in error ? (error as { context?: unknown }).context : null;
  if (context && typeof context === "object") {
    const response = context as {
      clone?: () => { json?: () => Promise<unknown>; text?: () => Promise<string> };
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
    };
    try {
      const jsonReader = response.clone ? response.clone() : response;
      const parsed = jsonReader.json ? await jsonReader.json() : null;
      if (parsed && typeof parsed === "object" && "message" in parsed && typeof (parsed as { message?: unknown }).message === "string") {
        return (parsed as { message: string }).message;
      }
    } catch {}
    try {
      const textReader = response.clone ? response.clone() : response;
      const raw = textReader.text ? await textReader.text() : "";
      if (raw) {
        const parsed = JSON.parse(raw) as { message?: string };
        if (typeof parsed?.message === "string" && parsed.message) return parsed.message;
      }
    } catch {}
  }
  return messageFromError || fallback;
}

export async function createPayexIntent(args: CreateIntentArgs) {
  if (!supabase) return { ok: false as const, message: "Supabase 未初始化" };
  const { data, error } = await supabase.functions.invoke("payex-create-intent", {
    body: args,
  });
  if (error) {
    const detail =
      data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : null;
    const resolved = detail || (await resolveFunctionErrorMessage(error, "创建支付会话失败"));
    return { ok: false as const, message: resolved };
  }
  return { ok: true as const, data };
}

export async function fetchPayexPaymentStatus(officialOrderId: string) {
  if (!supabase) return { ok: false as const, message: "Supabase 未初始化" };
  if (!isUuidLike(officialOrderId)) {
    return buildPaymentStatusFailure("Invalid order id", "invalid_order_id");
  }

  const { data, error } = await supabase.functions.invoke("payex-payment-status", {
    body: { officialOrderId },
  });

  const payload = data as PayexPaymentStatusPayload | null;
  if (payload?.invalidOrderId) {
    return buildPaymentStatusFailure(payload.message || "Invalid order id", "invalid_order_id");
  }
  if (payload?.notFound) {
    return buildPaymentStatusFailure(payload.message || "Order not found", "order_not_found");
  }

  if (error) {
    const detail =
      data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : null;
    const resolved = detail || (await resolveFunctionErrorMessage(error, "获取支付状态失败"));
    if (resolved === "Invalid order id") {
      return buildPaymentStatusFailure(resolved, "invalid_order_id");
    }
    if (resolved === "Order not found") {
      return buildPaymentStatusFailure(resolved, "order_not_found");
    }
    return buildPaymentStatusFailure(resolved);
  }

  return { ok: true as const, data };
}
