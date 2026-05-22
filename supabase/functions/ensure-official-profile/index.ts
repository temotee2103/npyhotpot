import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

function getFullName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  return (
    [
      typeof metadata.full_name === "string" ? metadata.full_name : null,
      typeof metadata.name === "string" ? metadata.name : null,
      typeof user.email === "string" ? user.email.split("@")[0] : null,
      "会员",
    ].find((value) => value && value.trim().length > 0)?.trim() ?? "会员"
  );
}

function getAvatarUrl(user: { user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  if (typeof metadata.avatar_url === "string" && metadata.avatar_url.trim()) return metadata.avatar_url.trim();
  if (typeof metadata.picture === "string" && metadata.picture.trim()) return metadata.picture.trim();
  return null;
}

serve(async (request) => {
  if (!isCorsAllowed(request)) return new Response("Forbidden", { status: 403 });
  const corsHeaders = buildCorsHeaders(request);
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

  const userRes = await supabase.auth.getUser(token);
  const user = userRes.data.user;
  if (userRes.error || !user) {
    return new Response(JSON.stringify({ message: userRes.error?.message ?? "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const existingProfile = await supabase
    .from("official_profiles")
    .select("id,role,status,full_name,phone,email,birth_date,address,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile.error) {
    return new Response(JSON.stringify({ message: existingProfile.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (existingProfile.data?.id) {
    return new Response(
      JSON.stringify({
        message: "ok",
        data: existingProfile.data,
        created: false,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  const insertedProfile = await supabase
    .from("official_profiles")
    .insert({
      id: user.id,
      full_name: getFullName(user),
      email: user.email?.toLowerCase() ?? null,
      avatar_url: getAvatarUrl(user),
      role: "customer",
      status: "active",
      membership_tier: "none",
      cumulative_spend_myr: 0,
    })
    .select("id,role,status,full_name,phone,email,birth_date,address,avatar_url")
    .maybeSingle();

  if (insertedProfile.error) {
    const retryProfile = await supabase
      .from("official_profiles")
      .select("id,role,status,full_name,phone,email,birth_date,address,avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (!retryProfile.error && retryProfile.data?.id) {
      return new Response(
        JSON.stringify({
          message: "ok",
          data: retryProfile.data,
          created: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    return new Response(JSON.stringify({ message: insertedProfile.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(
    JSON.stringify({
      message: "ok",
      data: insertedProfile.data,
      created: true,
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});
