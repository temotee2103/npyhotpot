import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";
import { callLalamove, getLalamoveMockMode } from "../_shared/lalamove.ts";

type QuoteRequest = {
  serviceType: string;
  language?: string;
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

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function getOptionalUserIdFromBearerToken(request: Request, supabase: ReturnType<typeof getSupabaseAdminClient>) {
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

function parseDistanceMeters(distance: unknown) {
  const row = distance as { value?: unknown; unit?: unknown } | null;
  const rawValue = row?.value;
  const unit = typeof row?.unit === "string" ? row.unit : "";
  const value = typeof rawValue === "number" ? rawValue : typeof rawValue === "string" ? Number(rawValue) : NaN;
  if (!Number.isFinite(value)) return null;
  if (unit === "m" || !unit) return Math.round(value);
  if (unit === "km") return Math.round(value * 1000);
  return Math.round(value);
}

async function upsertOfficialDeliveryQuote(args: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  userId: string | null;
  quotePayload: unknown;
}) {
  const { supabase, userId, quotePayload } = args;
  if (!supabase) return;
  const data = (quotePayload as { data?: unknown } | null)?.data ?? quotePayload;
  const quote = data as {
    quotationId?: unknown;
    serviceType?: unknown;
    expiresAt?: unknown;
    distance?: unknown;
    priceBreakdown?: unknown;
  } | null;

  const quotationId = typeof quote?.quotationId === "string" ? quote.quotationId : "";
  const serviceType = typeof quote?.serviceType === "string" ? quote.serviceType : "";
  const expiresAt = typeof quote?.expiresAt === "string" ? quote.expiresAt : null;
  const priceBreakdown = (quote?.priceBreakdown ?? {}) as Record<string, unknown>;
  const currency = typeof priceBreakdown?.currency === "string" ? (priceBreakdown.currency as string) : "";
  const totalRaw = priceBreakdown?.total;
  const fee = typeof totalRaw === "number" ? totalRaw : typeof totalRaw === "string" ? Number(totalRaw) : 0;
  const distanceMeters = parseDistanceMeters(quote?.distance);

  if (!quotationId || !serviceType || !currency || !Number.isFinite(fee)) return;

  await supabase
    .from("official_delivery_quotes")
    .upsert(
      {
        quotation_id: quotationId,
        user_id: userId,
        service_type: serviceType,
        currency,
        fee,
        distance_meters: distanceMeters,
        price_breakdown: priceBreakdown,
        expires_at: expiresAt,
      },
      { onConflict: "quotation_id" },
    );
}

serve(async (request) => {
  const corsHeaders = buildCorsHeaders(request);
  if (!isCorsAllowed(request)) {
    return new Response(JSON.stringify({ message: "CORS origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const body = (await request.json()) as QuoteRequest;
  if (!body?.serviceType || !body?.stops || body.stops.length < 2) {
    return new Response(JSON.stringify({ message: "Invalid quote payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabase = getSupabaseAdminClient();
  const userId = await getOptionalUserIdFromBearerToken(request, supabase);

  if (getLalamoveMockMode()) {
    const now = Date.now();
    const mock = {
      data: {
        quotationId: crypto.randomUUID(),
        serviceType: body.serviceType,
        specialRequests: body.specialRequests ?? [],
        expiresAt: new Date(now + 5 * 60 * 1000).toISOString(),
        scheduleAt: body.scheduleAt ?? null,
        distance: { value: 6200, unit: "m" },
        priceBreakdown: {
          total: "12.50",
          currency: "MYR",
          items: [{ name: "base_fee", amount: "8.00" }, { name: "distance_fee", amount: "4.50" }],
        },
      },
    };
    try {
      await upsertOfficialDeliveryQuote({ supabase, userId, quotePayload: mock });
    } catch {}
    return new Response(JSON.stringify(mock), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const providerPayload = {
    data: {
      serviceType: body.serviceType,
      language: body.language ?? "en_MY",
      scheduleAt: body.scheduleAt ?? undefined,
      specialRequests: body.specialRequests ?? undefined,
      stops: body.stops.map((stop) => ({
        address: stop.address,
        coordinates: {
          lat: String(stop.coordinates.lat),
          lng: String(stop.coordinates.lng),
        },
      })),
      item: body.item ?? undefined,
    },
  };

  const result = await callLalamove({
    method: "POST",
    path: "/v3/quotations",
    body: providerPayload,
  });
  if (!result.ok) {
    return new Response(JSON.stringify({ message: result.message }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    await upsertOfficialDeliveryQuote({ supabase, userId, quotePayload: result.data });
  } catch {}
  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
