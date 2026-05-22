"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAdminUiPayload, type AdminQuickLink } from "@/lib/admin/official-admin-ui";

type ChannelKey = "all" | "shop" | "delivery";

function AdminPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const channel = (searchParams.get("channel") as ChannelKey) || "all";
  const [quickLinks, setQuickLinks] = useState<AdminQuickLink[] | null>(null);

  const [today, setToday] = useState<null | {
    revenueMYRAll: number;
    revenueMYRShop: number;
    revenueMYRDelivery: number;
    ordersAll: number;
    ordersShop: number;
    ordersDelivery: number;
    paymentsTotal: number;
    paymentsSucceeded: number;
    deliveriesTotal: number;
    deliveriesCompleted: number;
    lowStockTitle: string | null;
    lowStockQty: number | null;
    pendingDeliveries: number;
  }>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const since = start.toISOString();

    const run = async () => {
      const [{ data: orders }, { data: payments }, { data: deliveries }, { data: lowStock }] = await Promise.all([
        client.from("official_orders").select("channel,currency,total,status").gte("created_at", since).limit(1000),
        client.from("official_payments").select("status").gte("created_at", since).limit(2000),
        client.from("official_deliveries").select("status").gte("created_at", since).limit(2000),
        client.from("official_soup_pack_variants").select("title,stock").eq("status", "active").order("stock", { ascending: true }).limit(1),
      ]);

      if (!active) return;

      const orderRows = (orders ?? []) as Array<{ channel: "shop" | "delivery"; currency: "MYR" | "SGD"; total: number }>;
      const paymentRows = (payments ?? []) as Array<{ status: string }>;
      const deliveryRows = (deliveries ?? []) as Array<{ status: string }>;
      const low = (lowStock ?? []) as Array<{ title: string; stock: number }>;

      const sumMYR = (xs: typeof orderRows) => xs.filter((o) => o.currency === "MYR").reduce((acc, o) => acc + Number(o.total ?? 0), 0);

      const ordersShop = orderRows.filter((o) => o.channel === "shop");
      const ordersDelivery = orderRows.filter((o) => o.channel === "delivery");

      const paymentsSucceeded = paymentRows.filter((p) => p.status === "succeeded").length;
      const deliveriesCompleted = deliveryRows.filter((d) => d.status === "completed").length;
      const pendingDeliveries = deliveryRows.filter((d) => d.status === "requested").length;

      setToday({
        revenueMYRAll: sumMYR(orderRows),
        revenueMYRShop: sumMYR(ordersShop),
        revenueMYRDelivery: sumMYR(ordersDelivery),
        ordersAll: orderRows.length,
        ordersShop: ordersShop.length,
        ordersDelivery: ordersDelivery.length,
        paymentsTotal: paymentRows.length,
        paymentsSucceeded,
        deliveriesTotal: deliveryRows.length,
        deliveriesCompleted,
        lowStockTitle: low[0]?.title ?? null,
        lowStockQty: typeof low[0]?.stock === "number" ? low[0].stock : null,
        pendingDeliveries,
      });
    };

    run();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchAdminUiPayload<AdminQuickLink[]>("admin_home_quick_links").then((data) => {
      if (!active) return;
      setQuickLinks(data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(() => {
    const money = (n: number | null | undefined) => (typeof n === "number" ? `RM ${n.toFixed(2)}` : "-");
    const pct = (n: number | null | undefined) => (typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "-");

    const paymentRate =
      today && today.paymentsTotal > 0 ? today.paymentsSucceeded / today.paymentsTotal : today ? 0 : null;
    const fulfillmentRate =
      today && today.deliveriesTotal > 0 ? today.deliveriesCompleted / today.deliveriesTotal : today ? 0 : null;

    const aovShop = today && today.ordersShop > 0 ? today.revenueMYRShop / today.ordersShop : today ? 0 : null;
    const aovDelivery = today && today.ordersDelivery > 0 ? today.revenueMYRDelivery / today.ordersDelivery : today ? 0 : null;

    return {
      all: [
        { label: "总营业额（MYR）", value: money(today?.revenueMYRAll), delta: "-" },
        { label: "订单总量", value: today ? String(today.ordersAll) : "-", delta: "-" },
        { label: "支付成功率", value: pct(paymentRate), delta: "-" },
        { label: "履约及时率", value: pct(fulfillmentRate), delta: "-" },
      ],
      shop: [
        { label: "商城销售额（MYR）", value: money(today?.revenueMYRShop), delta: "-" },
        { label: "商城订单", value: today ? String(today.ordersShop) : "-", delta: "-" },
        { label: "客单价（MYR）", value: typeof aovShop === "number" ? `RM ${aovShop.toFixed(1)}` : "-", delta: "-" },
        { label: "待处理订单", value: "-", delta: "-" },
      ],
      delivery: [
        { label: "外卖销售额（MYR）", value: money(today?.revenueMYRDelivery), delta: "-" },
        { label: "外卖订单", value: today ? String(today.ordersDelivery) : "-", delta: "-" },
        { label: "待分配配送单", value: today ? String(today.pendingDeliveries) : "-", delta: "-" },
        { label: "客单价（MYR）", value: typeof aovDelivery === "number" ? `RM ${aovDelivery.toFixed(1)}` : "-", delta: "-" },
      ],
    } satisfies Record<ChannelKey, Array<{ label: string; value: string; delta: string }>>;
  }, [today]);

  const alerts = useMemo(() => {
    const lowStockText =
      today?.lowStockTitle && typeof today.lowStockQty === "number"
        ? `库存预警：${today.lowStockTitle}（剩余 ${today.lowStockQty}）`
        : null;

    if (channel === "shop") {
      return [
        ...(lowStockText ? [{ level: "warning" as const, text: lowStockText }] : []),
        ...(today ? [{ level: "info" as const, text: `今日商城订单：${today.ordersShop}` }] : []),
      ];
    }
    if (channel === "delivery") {
      return [
        ...(today ? [{ level: "warning" as const, text: `待分配配送单：${today.pendingDeliveries}` }] : []),
        ...(today ? [{ level: "info" as const, text: `今日外卖订单：${today.ordersDelivery}` }] : []),
      ];
    }
    return [
      ...(today ? [{ level: "info" as const, text: `今日订单总量：${today.ordersAll}` }] : []),
      ...(lowStockText ? [{ level: "warning" as const, text: lowStockText }] : []),
      ...(today ? [{ level: "warning" as const, text: `待分配配送单：${today.pendingDeliveries}` }] : []),
    ];
  }, [channel, today]);

  const channelDesc =
    channel === "shop"
      ? "当前展示在线商城运营数据与任务。"
      : channel === "delivery"
        ? "当前展示外卖配送运营数据与任务。"
        : "当前展示全渠道（在线商城 + 外卖）统一运营视图。";

  const channelButtons: Array<{ key: ChannelKey; label: string; desc: string }> = [
    { key: "all", label: "全渠道", desc: "商城 + 外卖" },
    { key: "shop", label: "在线商城", desc: "汤包零售" },
    { key: "delivery", label: "外卖配送", desc: "点餐履约" },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-6 text-white">
          <p className="text-xs font-bold tracking-[0.16em]">OPERATIONS COMMAND CENTER</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">男朋友火锅标准后台</h1>
          <p className="mt-2 text-sm text-white/90">{channelDesc}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {channelButtons.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => router.replace(`${pathname}?channel=${item.key}`, { scroll: false })}
                className={`rounded-xl px-4 py-2 text-left transition ${
                  channel === item.key
                    ? "bg-white text-primary shadow-lg shadow-black/10"
                    : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <p className="text-sm font-bold">{item.label}</p>
                <p className={`text-[11px] ${channel === item.key ? "text-primary/80" : "text-white/80"}`}>{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-4">
          {cards[channel].map((card) => (
            <article key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-300">{card.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{card.value}</p>
              <p className="mt-1 text-xs font-bold text-primary">{card.delta}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">核心模块入口</h2>
            <span className="text-xs text-slate-500 dark:text-slate-300">按文档功能完整覆盖</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(quickLinks ?? []).map((item) => (
              <Link
                key={item.href}
                href={`${item.href}?channel=${channel}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-primary/40 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">{item.icon}</span>
                  <p className="font-bold">{item.title}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{item.desc}</p>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">运营提醒</h2>
          <div className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.text}
                className={`rounded-xl border p-3 ${
                  alert.level === "warning"
                    ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                    : "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                }`}
              >
                <p className="text-sm">{alert.text}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageContent />
    </Suspense>
  );
}
