import { supabase } from "@/lib/supabase";

export type DeliveryQuoteRequest = {
  serviceType: string;
  scheduleAt?: string | null;
  specialRequests?: string[];
  stops: Array<{
    address: string;
    coordinates: { lat: number; lng: number };
  }>;
  item?: {
    quantity?: string;
    weight?: string;
    categories?: string[];
    handlingInstructions?: string[];
  };
};

async function resolveFunctionErrorMessage(error: unknown, fallback: string) {
  const messageFromError = error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string"
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

export async function requestDeliveryQuote(payload: DeliveryQuoteRequest) {
  if (!supabase) return { ok: false as const, message: "Supabase 未初始化" };
  const { data, error } = await supabase.functions.invoke("delivery-quote", { body: payload });
  if (error) {
    const detail =
      data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : null;
    const resolved = detail || (await resolveFunctionErrorMessage(error, "请求报价失败"));
    return { ok: false as const, message: resolved };
  }
  return { ok: true as const, data };
}

export type DeliveryCreateRequest = {
  officialOrderId: string;
  quotationId: string;
  sender: {
    stopId: string;
    name: string;
    phone: string;
  };
  recipients: Array<{
    stopId: string;
    name: string;
    phone: string;
  }>;
  remarks?: string;
  metadata?: Record<string, string>;
  dropoffAddress: string;
  pickupOutletId?: string | null;
  quotationExpiresAt?: string | null;
  distanceMeters?: number | null;
  priceBreakdown?: unknown;
};

export async function createDeliveryDispatch(payload: DeliveryCreateRequest) {
  if (!supabase) return { ok: false as const, message: "Supabase 未初始化" };
  const { data, error } = await supabase.functions.invoke("delivery-create", { body: payload });
  if (error) {
    const detail =
      data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : null;
    const resolved = detail || (await resolveFunctionErrorMessage(error, "创建配送失败"));
    return { ok: false as const, message: resolved };
  }
  return { ok: true as const, data };
}
