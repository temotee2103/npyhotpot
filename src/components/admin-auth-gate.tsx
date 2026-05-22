"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase, hasSupabaseEnv, missingSupabaseEnv } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";

type GateState =
  | { kind: "loading" }
  | { kind: "missing_env"; missing: string[] }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "ready"; email: string | null };

function AdminAuthGateContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedPathname = useMemo(() => {
    if (!pathname) return "/";
    const withoutBasePath =
      siteConfig.basePath && pathname.startsWith(siteConfig.basePath) ? pathname.slice(siteConfig.basePath.length) || "/" : pathname;
    if (withoutBasePath.length > 1 && withoutBasePath.endsWith("/")) {
      return withoutBasePath.replace(/\/+$/, "");
    }
    return withoutBasePath;
  }, [pathname]);
  const [state, setState] = useState<GateState>(() => {
    if (!hasSupabaseEnv || !supabase) {
      return { kind: "missing_env", missing: missingSupabaseEnv };
    }
    return { kind: "loading" };
  });

  const channel = searchParams.get("channel") ?? "all";

  const loginHref = useMemo(() => {
    const next = encodeURIComponent(`${normalizedPathname}?channel=${channel}`);
    return `/admin/login?next=${next}`;
  }, [channel, normalizedPathname]);

  useEffect(() => {
    if (state.kind !== "loading") {
      return;
    }

    const client = supabase;
    if (!client) return;
    let active = true;

    const run = async () => {
      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        if (!active) return;
        setState({ kind: "unauthenticated" });
        return;
      }

      const email = session.user.email ?? null;

      const { data: profile, error } = await client
        .from("official_profiles")
        .select("role,status")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setState({ kind: "forbidden" });
        return;
      }

      if (!profile) {
        setState({ kind: "forbidden" });
        return;
      }

      if (profile.status !== "active") {
        setState({ kind: "forbidden" });
        return;
      }

      if (profile.role !== "admin" && profile.role !== "super_admin") {
        setState({ kind: "forbidden" });
        return;
      }

      setState({ kind: "ready", email });
    };

    run();

    const { data: subscription } = client.auth.onAuthStateChange(() => {
      run();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [state.kind]);

  if (state.kind === "ready") return <>{children}</>;

  if (state.kind === "missing_env") {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 text-amber-900 backdrop-blur-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <p className="text-lg font-black">Supabase 环境变量缺失</p>
        <p className="mt-2 text-sm">请在 .env.local 配置：</p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {state.missing.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (state.kind === "unauthenticated") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-5 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
          <p className="text-2xl font-black">需要管理员登录</p>
          <p className="mt-2 text-sm text-[color:var(--theme-muted)]">登录后才能查看/管理运营数据。</p>
          <div className="mt-4 flex gap-2">
            <Link className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90" href={loginHref}>
              前往登录
            </Link>
            <button
              type="button"
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
              onClick={() => router.refresh()}
            >
              刷新
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "forbidden") {
    return (
      <div className="rounded-2xl border border-rose-300 bg-rose-50/90 p-5 text-rose-900 backdrop-blur-sm dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="text-2xl font-black">权限不足</p>
        <p className="mt-2 text-sm">该账号不是管理员或账号状态不可用。</p>
        <div className="mt-4 flex gap-2">
          <Link className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90" href={loginHref}>
            重新登录
          </Link>
          <button
            type="button"
            className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
            onClick={async () => {
              await supabase?.auth.signOut();
              router.refresh();
            }}
          >
            退出登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-5 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
      <p className="text-sm text-[color:var(--theme-muted)]">加载中...</p>
    </div>
  );
}

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminAuthGateContent>{children}</AdminAuthGateContent>
    </Suspense>
  );
}
