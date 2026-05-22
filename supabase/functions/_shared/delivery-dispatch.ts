import { callLalamove, getLalamoveMockMode } from "./lalamove.ts";

export type DeliveryDispatchPayload = {
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

type SupabaseClientLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (field: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
  };
};

export async function createDeliveryDispatchRecord(
  supabase: SupabaseClientLike,
  body: DeliveryDispatchPayload,
): Promise<
  | { ok: true; data: Record<string, unknown>; alreadyExists?: boolean }
  | { ok: false; status: number; message: string }
> {
  const existed = await supabase.from("official_deliveries").select("id,lalamove_order_id,status").eq("order_id", body.officialOrderId).maybeSingle();
  if (existed.data?.id) return { ok: true, data: existed.data, alreadyExists: true };

  let providerOrderId = crypto.randomUUID();
  let providerPayload: unknown = null;

  if (!getLalamoveMockMode()) {
    const recipients = (body.recipients ?? []).map((recipient, index) => ({
      ...recipient,
      remarks: index === 0 ? body.remarks ?? undefined : undefined,
    }));
    const createPayload = {
      data: {
        quotationId: body.quotationId,
        sender: body.sender,
        recipients,
        metadata: body.metadata ?? {},
      },
    };
    const created = await callLalamove<{ data?: { orderId?: string } }>({ method: "POST", path: "/v3/orders", body: createPayload });
    if (!created.ok) return { ok: false, status: 502, message: created.message };
    providerPayload = created.data;
    providerOrderId = created.data?.data?.orderId ?? providerOrderId;
  }

  const inserted = await supabase
    .from("official_deliveries")
    .insert({
      order_id: body.officialOrderId,
      lalamove_order_id: providerOrderId,
      status: "requested",
      provider: "lalamove",
      pickup_outlet_id: body.pickupOutletId ?? null,
      dropoff_address: body.dropoffAddress,
      quotation_id: body.quotationId,
      quotation_expires_at: body.quotationExpiresAt ?? null,
      price_breakdown: body.priceBreakdown ?? null,
      distance_meters: body.distanceMeters ?? null,
      provider_payload: providerPayload,
    })
    .select("id,lalamove_order_id,status")
    .single();

  if (inserted.error || !inserted.data) {
    const message = inserted.error?.message ?? "";
    if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
      const existing = await supabase
        .from("official_deliveries")
        .select("id,lalamove_order_id,status")
        .eq("order_id", body.officialOrderId)
        .maybeSingle();
      if (existing.data?.id) return { ok: true, data: existing.data, alreadyExists: true };
    }
    return { ok: false, status: 500, message: inserted.error?.message ?? "Insert delivery failed" };
  }

  await supabase.from("official_delivery_events").insert({
    delivery_id: inserted.data.id,
    step: "requested",
    provider_status: "ORDER_CREATED",
    provider_payload: providerPayload,
  });

  return { ok: true, data: inserted.data };
}
