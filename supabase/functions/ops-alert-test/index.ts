import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { sendOpsAlert } from "../_shared/ops-alert.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
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

  const result = await sendOpsAlert(supabase, {
    source: "ops-alert-test",
    severity: "warning",
    title: "Test operations alert",
    message: "This is a manual test alert from the admin system health page.",
    detail: {
      invoked_by: "admin",
      actor_user_id: callerId,
    },
  });

  await supabase.from("official_admin_action_logs").insert({
    actor_user_id: callerId,
    actor_role: role,
    action: "ops_alert_dispatch",
    target_type: "system",
    target_id: "ops-alert-test",
    channel: "all",
    status: result.ok ? (result.skipped ? "skipped" : "success") : "failed",
    detail: {
      source_action: "ops-alert-test",
      severity: "warning",
      alert_message: result.message,
    },
  });

  return new Response(JSON.stringify({ ok: result.ok, skipped: result.skipped, message: result.message }), {
    status: result.ok ? 200 : 500,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
