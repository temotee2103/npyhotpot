import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";

type InvoiceGeneratePayload = {
  officialOrderId?: string;
  channel?: "shop" | "delivery";
  action?: "prepare" | "upload";
  pdfBase64?: string;
  sha256?: string;
  sizeBytes?: number;
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

function decodeBase64ToBytes(input: string) {
  const raw = input.includes(",") ? (input.split(",").pop() ?? "") : input;
  const cleaned = raw.trim();
  const decoded = atob(cleaned);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
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

  const body = (await request.json()) as InvoiceGeneratePayload;
  if (!body?.officialOrderId) {
    return new Response(JSON.stringify({ message: "officialOrderId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const action = body.action === "prepare" ? "prepare" : "upload";
  if (action !== "prepare" && !body.pdfBase64) {
    return new Response(JSON.stringify({ message: "pdfBase64 is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const access = await requireOrderAccess({ supabase, userId, officialOrderId: body.officialOrderId });
  if (!access.ok) {
    return new Response(JSON.stringify({ message: access.message }), {
      status: access.status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const order = await supabase
    .from("official_orders")
    .select("id,channel,currency,subtotal,shipping_fee,discount_total,total")
    .eq("id", body.officialOrderId)
    .maybeSingle();
  if (order.error) {
    return new Response(JSON.stringify({ message: order.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (!order.data?.id) {
    return new Response(JSON.stringify({ message: "Order not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const existingInvoice = await supabase
    .from("official_invoices")
    .select("id,invoice_no")
    .eq("order_id", body.officialOrderId)
    .maybeSingle();
  if (existingInvoice.error) {
    return new Response(JSON.stringify({ message: existingInvoice.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const invoiceBucket = "documents";
  let invoiceNoAllocated =
    typeof existingInvoice.data?.invoice_no === "string" ? existingInvoice.data.invoice_no.trim() : "";
  if (!invoiceNoAllocated) {
    const rpc = await supabase.rpc("official_next_invoice_no");
    if (rpc.error || typeof rpc.data !== "string" || !rpc.data.trim()) {
      return new Response(JSON.stringify({ message: rpc.error?.message ?? "Allocate invoice number failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    invoiceNoAllocated = rpc.data.trim();
  }

  const pdfPath = `invoices/${body.officialOrderId}/${invoiceNoAllocated}.pdf`;
  if (action === "prepare") {
    if (existingInvoice.data?.id) {
      return new Response(
        JSON.stringify({
          message: "Invoice prepared",
          data: { invoiceId: existingInvoice.data.id, invoiceNo: invoiceNoAllocated, pdfPath },
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const items = await supabase
      .from("official_order_items")
      .select("title,quantity,unit_price")
      .eq("order_id", body.officialOrderId);
    if (items.error) {
      return new Response(JSON.stringify({ message: items.error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const invoiceInserted = await supabase
      .from("official_invoices")
      .insert({
        order_id: body.officialOrderId,
        invoice_no: invoiceNoAllocated,
        currency: String(order.data.currency ?? "MYR"),
        subtotal: Number(order.data.subtotal ?? 0),
        shipping_fee: Number(order.data.shipping_fee ?? 0),
        discount_total: Number(order.data.discount_total ?? 0),
        total: Number(order.data.total ?? 0),
        pdf_bucket: invoiceBucket,
        pdf_path: pdfPath,
        created_by: userId,
      })
      .select("id,invoice_no")
      .single();
    if (invoiceInserted.error || !invoiceInserted.data?.id) {
      return new Response(JSON.stringify({ message: invoiceInserted.error?.message ?? "Create invoice failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const invoiceId = invoiceInserted.data.id;
    const invoiceItems = (items.data ?? []).map((x) => {
      const title = typeof x.title === "string" && x.title.trim() ? x.title : "-";
      const quantity = Math.max(1, Math.round(Number(x.quantity ?? 1)));
      const unitPrice = Number(x.unit_price ?? 0);
      return {
        invoice_id: invoiceId,
        title,
        quantity,
        unit_price: unitPrice,
        line_total: unitPrice * quantity,
      };
    });

    if (invoiceItems.length > 0) {
      const insertedItems = await supabase.from("official_invoice_items").insert(invoiceItems);
      if (insertedItems.error) {
        return new Response(JSON.stringify({ message: insertedItems.error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Invoice prepared",
        data: { invoiceId, invoiceNo: invoiceInserted.data.invoice_no, pdfPath },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const pdfBytes = decodeBase64ToBytes(body.pdfBase64 ?? "");

  const uploaded = await supabase.storage.from(invoiceBucket).upload(pdfPath, pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploaded.error) {
    return new Response(JSON.stringify({ message: uploaded.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (existingInvoice.data?.id) {
    const updated = await supabase
      .from("official_invoices")
      .update({
        pdf_bucket: invoiceBucket,
        pdf_path: pdfPath,
        pdf_sha256: typeof body.sha256 === "string" ? body.sha256 : null,
        pdf_size_bytes: typeof body.sizeBytes === "number" ? Math.round(body.sizeBytes) : null,
      })
      .eq("id", existingInvoice.data.id)
      .select("id,invoice_no")
      .maybeSingle();
    if (updated.error || !updated.data?.id) {
      return new Response(JSON.stringify({ message: updated.error?.message ?? "Update invoice failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({
        message: "Invoice PDF saved",
        data: { invoiceId: updated.data.id, invoiceNo: updated.data.invoice_no, pdfPath },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const items = await supabase
    .from("official_order_items")
    .select("title,quantity,unit_price")
    .eq("order_id", body.officialOrderId);
  if (items.error) {
    return new Response(JSON.stringify({ message: items.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const invoiceInserted = await supabase
    .from("official_invoices")
    .insert({
      order_id: body.officialOrderId,
      invoice_no: invoiceNoAllocated,
      currency: String(order.data.currency ?? "MYR"),
      subtotal: Number(order.data.subtotal ?? 0),
      shipping_fee: Number(order.data.shipping_fee ?? 0),
      discount_total: Number(order.data.discount_total ?? 0),
      total: Number(order.data.total ?? 0),
      pdf_bucket: invoiceBucket,
      pdf_path: pdfPath,
      pdf_sha256: typeof body.sha256 === "string" ? body.sha256 : null,
      pdf_size_bytes: typeof body.sizeBytes === "number" ? Math.round(body.sizeBytes) : null,
      created_by: userId,
    })
    .select("id,invoice_no")
    .single();
  if (invoiceInserted.error || !invoiceInserted.data?.id) {
    return new Response(JSON.stringify({ message: invoiceInserted.error?.message ?? "Create invoice failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const invoiceId = invoiceInserted.data.id;
  const invoiceItems = (items.data ?? []).map((x) => {
    const title = typeof x.title === "string" && x.title.trim() ? x.title : "-";
    const quantity = Math.max(1, Math.round(Number(x.quantity ?? 1)));
    const unitPrice = Number(x.unit_price ?? 0);
    return {
      invoice_id: invoiceId,
      title,
      quantity,
      unit_price: unitPrice,
      line_total: unitPrice * quantity,
    };
  });

  if (invoiceItems.length > 0) {
    const insertedItems = await supabase.from("official_invoice_items").insert(invoiceItems);
    if (insertedItems.error) {
      return new Response(JSON.stringify({ message: insertedItems.error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  return new Response(
    JSON.stringify({
      message: "Invoice PDF saved",
      data: { invoiceId, invoiceNo: invoiceInserted.data.invoice_no, pdfPath },
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});
