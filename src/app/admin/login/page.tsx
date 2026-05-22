"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { hasSupabaseEnv, missingSupabaseEnv, supabase } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";

function AdminLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const redirectTo = useMemo(() => {
    if (!next) return "/admin?channel=all";
    try {
      const decoded = decodeURIComponent(next);
      const withoutBasePath =
        siteConfig.basePath && decoded.startsWith(siteConfig.basePath) ? decoded.slice(siteConfig.basePath.length) || "/" : decoded;
      const normalizedNext =
        withoutBasePath.length > 1 && withoutBasePath.endsWith("/") ? withoutBasePath.replace(/\/+$/, "") : withoutBasePath;
      if (!normalizedNext.startsWith("/admin")) return "/admin?channel=all";
      if (normalizedNext.startsWith("/admin/login")) return "/admin?channel=all";
      return normalizedNext;
    } catch {
      return "/admin?channel=all";
    }
  }, [next]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    if (!hasSupabaseEnv || !supabase) {
      setError(`Supabase 环境变量缺失：${missingSupabaseEnv.join(", ")}`);
      return;
    }
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.replace(redirectTo);
  };

  const signInGoogle = async () => {
    setError(null);
    if (!hasSupabaseEnv || !supabase) {
      setError(`Supabase 环境变量缺失：${missingSupabaseEnv.join(", ")}`);
      return;
    }
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${redirectTo}` },
    });
    setBusy(false);
    if (authError) setError(authError.message);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <section className="rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-6 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
        <p className="text-xs font-bold tracking-[0.14em] text-primary">ADMIN LOGIN</p>
        <h1 className="mt-2 text-3xl font-black">运营控制台登录</h1>
        <p className="mt-2 text-sm text-[color:var(--theme-muted)]">仅管理员账号可进入后台。</p>
      </section>

      <section className="rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-6 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-[color:var(--theme-muted)]">邮箱</p>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-3 py-2 text-sm text-[color:var(--foreground)] dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface)]"
              placeholder="admin@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-[color:var(--theme-muted)]">密码</p>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-3 py-2 text-sm text-[color:var(--foreground)] dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface)]"
              type="password"
              autoComplete="current-password"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={signIn}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "登录中..." : "邮箱密码登录"}
          </button>
          <button
            type="button"
            onClick={signInGoogle}
            disabled={busy}
            className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-60"
          >
            Google 登录
          </button>
        </div>
      </section>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginPageContent />
    </Suspense>
  );
}
