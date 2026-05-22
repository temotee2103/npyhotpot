"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseEnv, missingSupabaseEnv, supabase } from "@/lib/supabase";
import { buildProfileCompletionHref, isProfileComplete, normalizeProfileCompletionNext } from "@/lib/profile-completion";

type CallbackState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string };

type CallbackProfile = {
  role: string | null;
  status: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  address: string | null;
} | null;

function toCallbackProfile(
  profile:
    | {
        role?: string | null;
        status?: string | null;
        full_name?: string | null;
        phone?: string | null;
        email?: string | null;
        birth_date?: string | null;
        address?: string | null;
      }
    | null
    | undefined,
): CallbackProfile {
  if (!profile) return null;
  return {
    role: profile.role ?? null,
    status: profile.status ?? null,
    full_name: profile.full_name ?? null,
    phone: profile.phone ?? null,
    email: profile.email ?? null,
    birth_date: profile.birth_date ?? null,
    address: profile.address ?? null,
  };
}

function decodeNextPath(value: string | null, fallback: string) {
  if (!value) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    return decoded.startsWith("/") ? decoded : fallback;
  } catch {
    return fallback;
  }
}

function normalizeReferral(value: string | null) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

function AuthCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>(() =>
    !hasSupabaseEnv || !supabase
      ? {
          kind: "error",
          message: `Supabase 环境变量缺失：${missingSupabaseEnv.join(", ")}`,
        }
      : {
          kind: "loading",
          message: "正在完成 Google 登录...",
        },
  );
  const handledRef = useRef(false);

  const source = searchParams.get("source") === "register" ? "register" : "login";
  const fallbackPath = source === "register" ? "/member/profile?welcome=1" : "/member/rewards";
  const nextPath = useMemo(() => decodeNextPath(searchParams.get("next"), fallbackPath), [fallbackPath, searchParams]);
  const referralCode = useMemo(() => normalizeReferral(searchParams.get("ref")), [searchParams]);

  useEffect(() => {
    const client = supabase;
    if (!hasSupabaseEnv || !client) {
      return;
    }

    let active = true;

    const ensureRewardsAccount = async () => {
      const rewardsRes = await client.functions.invoke("member-rewards-card", { body: {} });
      return rewardsRes.error ?? null;
    };

    const ensureOfficialProfile = async () => {
      const profileRes = await client.functions.invoke("ensure-official-profile", { body: {} });
      return {
        error: profileRes.error ?? null,
        data: (profileRes.data?.data ?? null) as {
          role?: string | null;
          status?: string | null;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          birth_date?: string | null;
          address?: string | null;
        } | null,
      };
    };

    const finalizeAuth = async (session: Session) => {
      if (handledRef.current || !active) return;
      handledRef.current = true;

      const user = session.user;
      const profileRes = await client
        .from("official_profiles")
        .select("role,status,full_name,phone,email,birth_date,address")
        .eq("id", user.id)
        .maybeSingle();

      let role = profileRes.data?.role ?? null;
      let status = profileRes.data?.status ?? null;
      let currentProfile = toCallbackProfile(profileRes.data);

      if (!profileRes.data) {
        const ensuredProfile = await ensureOfficialProfile();
        if (ensuredProfile.error) {
          setState({
            kind: "error",
            message: `Google 登录成功，但创建会员资料失败：${ensuredProfile.error.message}`,
          });
          return;
        }

        currentProfile = toCallbackProfile(ensuredProfile.data);
        role = ensuredProfile.data?.role ?? "customer";
        status = ensuredProfile.data?.status ?? "active";

        const rewardsError = await ensureRewardsAccount();
        if (rewardsError) {
          setState({
            kind: "error",
            message: `Google 登录成功，但初始化积分账户失败：${rewardsError.message}`,
          });
          return;
        }

        if (referralCode) {
          const referralBindRes = await client.rpc("official_bind_referral_by_code", {
            p_referred_user_id: user.id,
            p_referral_code: referralCode,
          });
          if (referralBindRes.error) {
            setState({
              kind: "error",
              message: `Google 登录成功，但绑定推荐关系失败：${referralBindRes.error.message}`,
            });
            return;
          }
        }
      } else if (profileRes.data.role === "customer" || profileRes.data.role === null) {
        await ensureRewardsAccount();
      }

      if (!active) return;

      if (status !== "active") {
        router.replace("/");
        return;
      }

      if (role === "admin" || role === "super_admin") {
        router.replace("/admin?channel=all");
        return;
      }

      if (role === "merchant") {
        router.replace("/merchant/rewards/scan");
        return;
      }

      if (!isProfileComplete(currentProfile)) {
        router.replace(buildProfileCompletionHref(normalizeProfileCompletionNext(nextPath), source === "register"));
        return;
      }

      router.replace(nextPath);
    };

    const tryReadSession = async () => {
      for (let attempt = 0; attempt < 8 && active && !handledRef.current; attempt += 1) {
        const { data } = await client.auth.getSession();
        if (data.session) {
          await finalizeAuth(data.session);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }

      if (!handledRef.current && active) {
        setState({
          kind: "error",
          message: "未能完成 Google 登录，请返回后重新尝试。",
        });
      }
    };

    void tryReadSession();

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void finalizeAuth(session);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [nextPath, referralCode, router, source]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(117,2,15,0.22),transparent_32%),radial-gradient(circle_at_bottom,rgba(201,175,147,0.06),transparent_28%),linear-gradient(180deg,#170d10_0%,#0d0709_100%)]" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-primary/15 bg-[rgba(28,16,19,0.92)] p-6 shadow-[0_30px_80px_-36px_rgba(0,0,0,0.75)] backdrop-blur-xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Google Auth</p>
        <h1 className="mt-3 text-2xl font-black text-[color:var(--foreground)]">
          {state.kind === "loading" ? "正在跳转中" : "登录未完成"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--theme-muted-strong)]">{state.message}</p>
        {source === "register" ? (
          <p className="mt-2 text-xs leading-5 text-[color:var(--theme-muted)]">首次使用 Google 注册后，基础会员资料会自动创建，其他资料可稍后在会员中心补充。</p>
        ) : null}
        {state.kind === "error" ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90">
              返回登录
            </Link>
            <Link href="/register" className="rounded-full border border-primary/30 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10">
              前往注册
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-3 text-xs text-[color:var(--theme-muted)]">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
            <span>正在同步会话与会员资料...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackPageContent />
    </Suspense>
  );
}
