import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  full_name?: string;
  phone?: string;
  email?: string;
  password?: string;
  avatar_url?: string;
  address?: string;
  birth_date?: string | null;
  referral_code?: string | null;
  role?: "customer" | "merchant" | "admin" | "super_admin";
  outlet_id?: string | null;
  status?: "active" | "pending_review" | "disabled";
};

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

async function ensureMemberRewardsAccount(supabase: ReturnType<typeof getSupabaseAdminClient>, userId: string) {
  if (!supabase || !userId) return { ok: false as const, message: "Missing Supabase or userId" };

  const referralBind = await supabase.rpc("official_bind_referral_from_user_metadata", { p_user_id: userId });
  if (referralBind.error) {
    return { ok: false as const, message: referralBind.error.message };
  }

  let account = await supabase
    .from("official_member_rewards_accounts")
    .select("user_id,rewards_code,qr_payload,status")
    .eq("user_id", userId)
    .maybeSingle();
  if (account.error) {
    return { ok: false as const, message: account.error.message };
  }

  if (!account.data?.user_id) {
    const created = await supabase
      .from("official_member_rewards_accounts")
      .insert({ user_id: userId, status: "active" })
      .select("user_id,rewards_code,qr_payload,status")
      .maybeSingle();
    if (created.error || !created.data?.user_id) {
      return { ok: false as const, message: created.error?.message ?? "Create rewards account failed" };
    }
    account = created;
  }

  const qrPayload = (account.data.qr_payload ?? account.data.rewards_code ?? "").trim();
  if (!account.data.qr_payload && qrPayload) {
    const updateQr = await supabase.from("official_member_rewards_accounts").update({ qr_payload: qrPayload }).eq("user_id", userId);
    if (updateQr.error) {
      return { ok: false as const, message: updateQr.error.message };
    }
  }

  return { ok: true as const };
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

  const callerUser = await supabase.auth.getUser(token);
  if (callerUser.error || !callerUser.data.user) {
    return new Response(JSON.stringify({ message: callerUser.error?.message ?? "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const callerProfile = await supabase
    .from("official_profiles")
    .select("id,role,status")
    .eq("id", callerUser.data.user.id)
    .maybeSingle();
  if (callerProfile.error || !callerProfile.data) {
    return new Response(JSON.stringify({ message: callerProfile.error?.message ?? "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (callerProfile.data.status !== "active" || (callerProfile.data.role !== "admin" && callerProfile.data.role !== "super_admin")) {
    return new Response(JSON.stringify({ message: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const body = (await request.json()) as Payload;
  const role = body.role ?? "customer";
  const outletId = (body.outlet_id ?? "").trim();
  const status = body.status ?? "active";
  const fullName = body.full_name?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password?.trim() ?? "";
  const avatarUrl = body.avatar_url?.trim() ?? "";
  const address = body.address?.trim() ?? "";
  const birthDate = body.birth_date?.trim() ?? "";
  const referralCode = body.referral_code?.trim().toUpperCase() ?? "";
  const requiresContactProfile = role === "customer" || role === "merchant";

  if (!fullName || !email || !password) {
    return new Response(JSON.stringify({ message: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (requiresContactProfile && (!phone || !address)) {
    return new Response(JSON.stringify({ message: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (!email.includes("@")) {
    return new Response(JSON.stringify({ message: "Invalid email" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ message: "Password must be at least 8 characters" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (role === "super_admin" && callerProfile.data.role !== "super_admin") {
    return new Response(JSON.stringify({ message: "Only super_admin can create super_admin" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (role === "merchant" && !outletId) {
    return new Response(JSON.stringify({ message: "outlet_id is required for merchant" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (role === "merchant") {
    const outlet = await supabase.from("official_outlets").select("id,is_active").eq("id", outletId).maybeSingle();
    if (outlet.error || !outlet.data?.id || !outlet.data.is_active) {
      return new Response(JSON.stringify({ message: outlet.error?.message ?? "Invalid outlet_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  const createdAuth = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      ...(phone ? { phone } : {}),
      ...(birthDate ? { birth_date: birthDate } : {}),
      ...(referralCode ? { referral_code: referralCode } : {}),
    },
  });
  if (createdAuth.error || !createdAuth.data.user) {
    return new Response(JSON.stringify({ message: createdAuth.error?.message ?? "Create auth user failed" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const profile = await supabase.from("official_profiles").upsert(
    {
      id: createdAuth.data.user.id,
      full_name: fullName,
      phone: phone || null,
      email,
      avatar_url: avatarUrl || null,
      address: address || null,
      birth_date: birthDate || null,
      role,
      status,
    },
    { onConflict: "id" },
  );

  if (profile.error) {
    await supabase.auth.admin.deleteUser(createdAuth.data.user.id);
    return new Response(JSON.stringify({ message: profile.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (role === "merchant") {
    const merchantAccount = await supabase.from("official_merchant_accounts").upsert(
      {
        profile_id: createdAuth.data.user.id,
        outlet_id: outletId,
        status: "active",
      },
      { onConflict: "profile_id" },
    );
    if (merchantAccount.error) {
      await supabase.from("official_profiles").delete().eq("id", createdAuth.data.user.id);
      await supabase.auth.admin.deleteUser(createdAuth.data.user.id);
      return new Response(JSON.stringify({ message: merchantAccount.error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  if (role === "customer") {
    const rewardsInit = await ensureMemberRewardsAccount(supabase, createdAuth.data.user.id);
    if (!rewardsInit.ok) {
      await supabase.from("official_profiles").delete().eq("id", createdAuth.data.user.id);
      await supabase.auth.admin.deleteUser(createdAuth.data.user.id);
      return new Response(JSON.stringify({ message: rewardsInit.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  return new Response(
    JSON.stringify({
      message: "User created",
      data: { id: createdAuth.data.user.id },
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});
