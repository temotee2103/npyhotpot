"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  buildProfileCompletionHref,
  isProfileComplete,
  isProfileCompletionPath,
  normalizeProfileCompletionNext,
  type CustomerProfileCompletionShape,
} from "@/lib/profile-completion";

type ProfileGateRow = CustomerProfileCompletionShape & {
  role: "customer" | "merchant" | "admin" | "super_admin" | null;
  status: string | null;
};

function isProtectedPath(pathname: string) {
  return (
    (pathname.startsWith("/member") && !isProfileCompletionPath(pathname)) ||
    pathname === "/shop/checkout" ||
    pathname === "/delivery/checkout"
  );
}

function ProfileCompletionGateContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shouldGatePath = isProtectedPath(pathname);
  const [resolvedPath, setResolvedPath] = useState<string | null>(() => (shouldGatePath && supabase ? null : pathname));

  const currentPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    const client = supabase;
    if (!shouldGatePath || !client) return;

    let active = true;

    const run = async () => {
      const sessionRes = await client.auth.getSession();
      const userId = sessionRes.data.session?.user?.id;
      if (!active || !userId) {
        setResolvedPath(pathname);
        return;
      }

      const profileRes = await client
        .from("official_profiles")
        .select("role,status,full_name,phone,email,birth_date,address")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      const profile = (profileRes.data as ProfileGateRow | null) ?? null;
      const gatedNext = normalizeProfileCompletionNext(currentPath);
      if (!profile || profile.status !== "active") {
        router.replace(buildProfileCompletionHref(gatedNext));
        return;
      }
      if (profile.role && profile.role !== "customer") {
        setResolvedPath(pathname);
        return;
      }
      if (!isProfileComplete(profile)) {
        router.replace(buildProfileCompletionHref(gatedNext));
        return;
      }

      setResolvedPath(pathname);
    };

    void run();

    const { data: subscription } = client.auth.onAuthStateChange(() => {
      void run();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [currentPath, pathname, router, shouldGatePath]);

  if (shouldGatePath && resolvedPath !== pathname) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 py-10">
        <div className="rounded-2xl border border-primary/15 bg-[color:var(--theme-surface-elevated)] px-5 py-4 text-sm text-[color:var(--theme-muted)] shadow-sm backdrop-blur-sm">
          正在检查会员资料完整性...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function ProfileCompletionGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ProfileCompletionGateContent>{children}</ProfileCompletionGateContent>
    </Suspense>
  );
}
