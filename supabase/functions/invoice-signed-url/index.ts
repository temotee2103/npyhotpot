import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";

type InvoiceSignedUrlPayload = {
  invoiceId?: string;
  officialOrderId?: string;
};

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

  const body = (await request.json()) as InvoiceSignedUrlPayload;
  if (!body?.invoiceId && !body?.officialOrderId) {
    return new Response(JSON.stringify({ message: "invoiceId or officialOrderId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const invoiceQuery = supabase.from("official_invoices").select("id,order_id,invoice_no,pdf_bucket,pdf_path");
  const invoice = body.invoiceId
    ? await invoiceQuery.eq("id", body.invoiceId).maybeSingle()
    : await invoiceQuery.eq("order_id", body.officialOrderId ?? "").maybeSingle();
  if (invoice.error) {
    return new Response(JSON.stringify({ message: invoice.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (!invoice.data?.id) {
    return new Response(JSON.stringify({ message: "Invoice not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const access = await requireOrderAccess({ supabase, userId, officialOrderId: invoice.data.order_id });
  if (!access.ok) {
    return new Response(JSON.stringify({ message: access.message }), {
      status: access.status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const bucket = String(invoice.data.pdf_bucket ?? "").trim();
  const path = String(invoice.data.pdf_path ?? "").trim();
  if (!bucket || !path) {
    return new Response(JSON.stringify({ message: "Invoice PDF not available" }), {
      status: 409,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const signed = await supabase.storage.from(bucket).createSignedUrl(path, 120);
  if (signed.error || !signed.data?.signedUrl) {
    return new Response(JSON.stringify({ message: signed.error?.message ?? "Create signed URL failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(
    JSON.stringify({
      message: "Signed URL created",
      data: { invoiceId: invoice.data.id, invoiceNo: invoice.data.invoice_no, signedUrl: signed.data.signedUrl },
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});

