"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { fetchOfficialBundles, fetchOfficialDiscounts, fetchOfficialSoupPackVariants } from "@/lib/admin/official-shop";
import { supabase } from "@/lib/supabase";
import { fetchAdminUiPayload, type AdminDeliveryModuleCard } from "@/lib/admin/official-admin-ui";

function AdminShopPageContent() {
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "shop";
  const [counts, setCounts] = useState<null | { variants: number; bundles: number; enabledDiscounts: number }>(null);
  const [todayOrders, setTodayOrders] = useState<number | null>(null);
  const [moduleCards, setModuleCards] = useState<AdminDeliveryModuleCard[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchOfficialSoupPackVariants(), fetchOfficialBundles(), fetchOfficialDiscounts("shop")]).then(([variants, bundles, discounts]) => {
      if (!active) return;
      setCounts({
        variants: variants.length,
        bundles: bundles.length,
        enabledDiscounts: discounts.filter((d) => d.status === "enabled").length,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchAdminUiPayload<AdminDeliveryModuleCard[]>("admin_shop_module_cards").then((data) => {
      if (!active) return;
      setModuleCards(data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    supabase
      .from("official_orders")
      .select("id", { count: "exact", head: true })
      .eq("channel", "shop")
      .gte("created_at", start.toISOString())
      .then((res) => {
        if (!active) return;
        setTodayOrders(res.count ?? 0);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">SHOP MANAGEMENT</p>
            <h1 className="mt-1 text-3xl font-black">在线商城运营与商品体系</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">当前渠道视图：{channel}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">支持单品 + Bundle Set（买X送Y/客制化组合）+ 多币种（MYR/SGD）</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/shop/products?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10"
            >
              商品管理
            </Link>
            <Link
              href={`/admin/shop/bundles?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10"
            >
              Bundle Set
            </Link>
            <Link
              href={`/admin/shop/banners?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10"
            >
              限时优惠
            </Link>
            <Link
              href={`/admin/shop/shipping?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10"
            >
              运费设定
            </Link>
            <Link
              href="/admin/shop/orders"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90"
            >
              查看订单
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">商品 SKU</p>
          <p className="mt-2 text-2xl font-black">{counts?.variants ?? "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">Bundle Set</p>
          <p className="mt-2 text-2xl font-black text-primary">{counts?.bundles ?? "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">启用优惠券</p>
          <p className="mt-2 text-2xl font-black text-primary">{counts?.enabledDiscounts ?? "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">今日订单</p>
          <p className="mt-2 text-2xl font-black">{todayOrders ?? "-"}</p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(moduleCards ?? []).map((card) => (
          <Link
            key={card.href}
            href={`${card.href}?channel=${channel}`}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/40 hover:bg-primary/5 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-primary/10"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">{card.icon}</span>
              <p className="text-lg font-black">{card.title}</p>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{card.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

export default function AdminShopPage() {
  return (
    <Suspense fallback={null}>
      <AdminShopPageContent />
    </Suspense>
  );
}
