"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AdminDispatchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const channel = searchParams.get("channel");
    router.replace(channel ? `/admin/delivery/orders?channel=${channel}` : "/admin/delivery/orders");
  }, [router, searchParams]);

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 dark:text-slate-300">
      正在跳转到统一的配送订单页面...
    </div>
  );
}

export default function AdminDispatchPage() {
  return (
    <Suspense fallback={null}>
      <AdminDispatchPageContent />
    </Suspense>
  );
}
