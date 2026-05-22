"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { assetPath } from "@/lib/site-config";
import { hasSupabaseEnv, missingSupabaseEnv, supabase } from "@/lib/supabase";
import { buildProfileCompletionHref, isProfileComplete } from "@/lib/profile-completion";
import { isValidE164Phone, normalizePhoneToE164 } from "@/lib/validators/phone";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const redirectPath = useMemo(() => {
    const next = searchParams.get("next");
    if (!next) return "/";
    try {
      const decoded = decodeURIComponent(next);
      return decoded.startsWith("/") ? decoded : "/";
    } catch {
      return "/";
    }
  }, [searchParams]);

  const resolveEmailFromAccount = async (value: string) => {
    const raw = value.trim().toLowerCase();
    if (raw.includes("@")) return raw;
    const normalizedPhone = normalizePhoneToE164(raw);
    if (!isValidE164Phone(normalizedPhone)) return null;
    if (!supabase) return null;
    const { data } = await supabase.from("official_profiles").select("email").eq("phone", normalizedPhone).maybeSingle();
    return data?.email?.toLowerCase() ?? null;
  };

  const routeAfterLogin = useCallback(async () => {
    if (!supabase) return router.replace(redirectPath);
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return router.replace(redirectPath);
    const profileRes = await supabase
      .from("official_profiles")
      .select("role,status,full_name,phone,email,birth_date,address")
      .eq("id", userId)
      .maybeSingle();
    const role = profileRes.data?.role;
    const status = profileRes.data?.status;
    if (status !== "active") return router.replace("/");
    if (role === "admin" || role === "super_admin") return router.replace("/admin?channel=all");
    if (role === "merchant") return router.replace("/merchant/rewards/scan");
    if (!isProfileComplete(profileRes.data)) {
      return router.replace(buildProfileCompletionHref(redirectPath));
    }
    return router.replace(redirectPath);
  }, [redirectPath, router]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    const run = async () => {
      const { data } = await client.auth.getSession();
      if (!active || !data.session) return;
      await routeAfterLogin();
    };
    void run();
    return () => {
      active = false;
    };
  }, [routeAfterLogin]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!hasSupabaseEnv || !supabase) {
      setMessage(`Supabase 环境变量缺失：${missingSupabaseEnv.join(", ")}`);
      return;
    }
    if (!account.trim() || !password) {
      setMessage("请输入账号和密码");
      return;
    }
    const email = await resolveEmailFromAccount(account);
    if (!email) {
      setMessage("账号不存在或手机号格式不正确");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    try {
      await supabase.functions.invoke("ensure-official-profile", { body: {} });
    } catch {}
    await routeAfterLogin();
  };

  const onGoogleLogin = async () => {
    setMessage(null);
    if (!hasSupabaseEnv || !supabase) {
      setMessage(`Supabase 环境变量缺失：${missingSupabaseEnv.join(", ")}`);
      return;
    }
    setBusy(true);
    const params = new URLSearchParams({
      source: "login",
      next: redirectPath,
    });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${params.toString()}`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    setBusy(false);
    if (error) setMessage(error.message);
  };

  const onResetPassword = async () => {
    setMessage(null);
    if (!hasSupabaseEnv || !supabase) {
      setMessage(`Supabase 环境变量缺失：${missingSupabaseEnv.join(", ")}`);
      return;
    }
    const email = await resolveEmailFromAccount(account);
    if (!email) {
      setMessage("请先输入有效邮箱或已绑定手机号");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("重置密码邮件已发送，请检查邮箱");
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-6 md:py-8"
      style={{
        backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDDVIm0gONe80jA6AuJrXzUATNHRCAsVSGPRm3w7qXhLqKaOmMXCBOEnT-BHAg2EKDTOB4JJ1xdjZDDGmG-1M8oyiJUcuN1vi4lg5nEr8U5lHpQlmINZceuIyYvjYTnt8q7vZLshrPGma1wGWvDzNJJrwqpqHvwu7oilf6OXcl0DDgp03NJ4NI18GU-kUVxTXBS9YQYp34ZLrff1OcoBjRcksLL9DpzdeTXB2o3GaXkL41oY08Zlf03tzbQ3435XMlS-ZedY8oMdmQw')`,
      }}
    >
      <div className="absolute inset-0 bg-[#221011]/74" />
      <div className="absolute inset-x-0 top-0 z-20 flex items-center px-4 py-4 md:px-8">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-[color:var(--theme-surface-elevated)] px-4 py-2 text-sm font-bold text-[color:var(--foreground)] shadow-sm backdrop-blur-md hover:border-primary/40 hover:text-primary">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          返回首页
        </Link>
      </div>
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-primary/15 bg-[rgba(28,16,19,0.9)] shadow-[0_28px_70px_-34px_rgba(0,0,0,0.82)] backdrop-blur-xl">
        <div 
          className="relative flex h-32 w-full flex-col justify-end bg-cover bg-center bg-no-repeat p-4 sm:h-36 sm:p-5"
          style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDkbUAaSO_d7CnQveh9F2sEURNomQoij-dzUfZ3PEjuuD9ebdG_slTnXSwqIY8fCq13etD62_DzfT5PdoCmDaQ3upg3cOmlIQniUpj8xu5gKa9EN5Ou4b0R77XuGAOjMNeXje0El98PGuHPIinU3pCm1TitqRbNAqIEe4rNj4uIgwu6HgG-Trm33sKG2cQmrNWKEnocfFRwMCptEzgO9d-iY0_90HiOU_4_czfCdi_jA0rsUsKjARcPndlpWQh6TIAZ9iccEcCf4ccO')` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#221011] via-[#221011]/70 to-transparent"></div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="relative h-14 w-14 rounded-xl bg-white/10 p-1 shadow-sm backdrop-blur-sm">
               <Image 
                src={assetPath("/favicon.png")} 
                alt="Nanpengyou Logo" 
                fill 
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Member Access</p>
              <h1 className="text-2xl font-black leading-tight tracking-tight text-white">男朋友火锅</h1>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--theme-muted-strong)]">Nanpengyou Hotpot</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-1.5">
            <h2 className="text-xl font-bold text-[color:var(--foreground)]">欢迎回来</h2>
            <p className="text-sm text-[color:var(--theme-muted)]">登录您的楠朋友火锅账号，继续下单、查看积分与会员权益。</p>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2 md:hidden">
            <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
              <p className="text-[10px] font-black tracking-[0.12em] text-primary">STEP 1</p>
              <p className="mt-1 text-xs font-bold text-[color:var(--foreground)]">登录账号</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
              <p className="text-[10px] font-black tracking-[0.12em] text-primary">STEP 2</p>
              <p className="mt-1 text-xs font-bold text-[color:var(--foreground)]">查看订单</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
              <p className="text-[10px] font-black tracking-[0.12em] text-primary">STEP 3</p>
              <p className="mt-1 text-xs font-bold text-[color:var(--foreground)]">累计积分</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">手机号 / 邮箱</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">account_circle</span>
                <input 
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" 
                  placeholder="请输入您的手机号或邮箱" 
                  type="text"
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">密码</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">lock</span>
                <input 
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-11 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" 
                  placeholder="请输入密码" 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button 
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[color:var(--theme-muted-soft)] transition-colors hover:text-[color:var(--theme-muted-strong)]" 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-0.5">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  className="rounded border-white/10 bg-white/5 text-primary focus:ring-primary focus:ring-offset-[#221011]"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span className="text-xs text-[color:var(--theme-muted)] transition-colors group-hover:text-[color:var(--theme-muted-strong)]">记住我</span>
              </label>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => void onResetPassword()}>
                忘记密码？
              </button>
            </div>
            
            {message ? <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">{message}</p> : null}

            <button disabled={busy} className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] hover:bg-primary/90 disabled:opacity-60" type="submit">
              {busy ? "处理中..." : "登录"}
            </button>
          </form>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#221011] px-3 text-[color:var(--theme-muted-soft)]">Google</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <GoogleAuthButton disabled={busy} onClick={() => void onGoogleLogin()} label="Sign in with Google" />
            <p className="text-center text-[11px] leading-5 text-[color:var(--theme-muted-soft)]">会自动跳回原本想访问的页面，并支持选择其他 Google 账号。</p>
          </div>
          
          <div className="mt-6 border-t border-white/5 pt-5 text-center">
            <p className="text-sm text-[color:var(--theme-muted)]">
              还没有账号？
              <Link className="ml-1 font-bold text-primary hover:underline" href="/register">立即注册</Link>
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-2 bg-primary/5 px-4 py-3">
          <span className="material-symbols-outlined text-primary text-sm">verified_user</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--theme-muted-soft)]">Secure SSL Encryption</span>
        </div>
      </div>
      <div aria-hidden className="mobile-page-bottom-space md:hidden" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
