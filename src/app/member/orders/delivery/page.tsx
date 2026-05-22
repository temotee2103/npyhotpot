"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createPayexIntent } from "@/lib/payments/payex";
import { MemberShell } from "@/components/member-shell";

type DeliveryOrderRow = {
  id: string;
  status: string;
  currency: "MYR" | "SGD";
  total: number;
  created_at: string;
};

type DeliveryStatusRow = {
  order_id: string;
  status: string;
};

function badgeClass(value: string) {
  const normalized = value.toLowerCase();
  if (["paid", "completed", "delivered"].includes(normalized)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (["fulfilling"].includes(normalized)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (["pending", "created", "accepted", "assigned", "picked_up", "in_transit", "processing"].includes(normalized)) return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (["payment_failed", "cancelled", "failed", "refunded"].includes(normalized)) return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  return "border-primary/20 bg-primary/10 text-primary";
}

export default function MemberDeliveryOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<DeliveryOrderRow[]>([]);
  const [deliveryStatusMap, setDeliveryStatusMap] = useState<Record<string, string>>({});
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!supabase) {
        if (!active) return;
        setError("Supabase 未初始化");
        setLoading(false);
        return;
      }
      const sessionRes = await supabase.auth.getSession();
      const userId = sessionRes.data.session?.user?.id;
      if (!userId) {
        if (!active) return;
        setError("请先登录后查看外卖订单");
        setLoading(false);
        return;
      }
      const ordersRes = await supabase
        .from("official_orders")
        .select("id,status,currency,total,created_at")
        .eq("user_id", userId)
        .eq("channel", "delivery")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (ordersRes.error) {
        setError(ordersRes.error.message);
        setLoading(false);
        return;
      }
      const rows = (ordersRes.data as DeliveryOrderRow[] | null) ?? [];
      setOrders(rows);
      const ids = rows.map((row) => row.id);
      if (ids.length > 0) {
        const deliveriesRes = await supabase.from("official_deliveries").select("order_id,status").in("order_id", ids);
        if (!active) return;
        if (deliveriesRes.error) {
          setError(deliveriesRes.error.message);
        } else {
          const statusMap: Record<string, string> = {};
          ((deliveriesRes.data as DeliveryStatusRow[] | null) ?? []).forEach((row) => {
            statusMap[row.order_id] = row.status;
          });
          setDeliveryStatusMap(statusMap);
        }
      }
      setLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  const retryPayment = async (orderId: string) => {
    setActionMessage(null);
    if (retryingOrderId) return;
    setRetryingOrderId(orderId);
    const res = await createPayexIntent({
      officialOrderId: orderId,
      channel: "delivery",
      returnUrl: `${window.location.origin}/payment/result`,
    });
    setRetryingOrderId(null);
    if (!res.ok) {
      setActionMessage(res.message);
      return;
    }
    const paymentUrl = (res.data as { data?: { paymentUrl?: string } })?.data?.paymentUrl ?? "";
    if (!paymentUrl) {
      setActionMessage("创建支付链接失败");
      return;
    }
    window.location.href = paymentUrl;
  };

  const totalOrders = useMemo(() => orders.length, [orders.length]);
  const activeDeliveries = useMemo(
    () => orders.filter((order) => ["created", "accepted", "assigned", "picked_up", "in_transit"].includes((deliveryStatusMap[order.id] ?? "").toLowerCase())).length,
    [deliveryStatusMap, orders],
  );

  return (
    <MemberShell
      activeKey="delivery_orders"
      title="外卖订单"
      subtitle="查看外卖订单、配送履约状态与历史记录。"
      stats={[
        { label: "订单总数", value: String(totalOrders) },
        { label: "履约中", value: String(activeDeliveries) },
      ]}
    >
      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900/70">加载中...</section>
      ) : error ? (
          <p>{error}</p>
          <Link href="/login" className="mt-3 inline-flex rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10">
            去登录
          </Link>
        </section>
      ) : (
        <section className="ui-table-root overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          {actionMessage ? (
            <div className="border-b border-primary/10 bg-primary/5 px-4 py-3 text-sm text-primary">{actionMessage}</div>
          ) : null}
          <div className="space-y-3 p-3 md:hidden">
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                暂无外卖订单
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="rounded-3xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.12em] text-primary">DELIVERY ORDER</p>
                      <p className="mt-1 text-base font-black text-[color:var(--foreground)]">{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="mt-1 text-xs text-[color:var(--theme-muted)]">{new Date(order.created_at).toLocaleString("zh-CN")}</p>
                    </div>
                    <Link
                      href={`/member/orders/delivery?order=${encodeURIComponent(order.id)}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/30 text-primary transition hover:bg-primary/10"
                      aria-label="查看追踪"
                      title="查看追踪"
                    >
                      <span className="material-symbols-outlined text-base">track_changes</span>
                    </Link>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-black/3 px-3 py-3 dark:bg-white/5">
                      <p className="text-[10px] text-[color:var(--theme-muted)]">订单状态</p>
                      <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeClass(order.status)}`}>{order.status}</span>
                    </div>
                    <div className="rounded-2xl bg-black/3 px-3 py-3 dark:bg-white/5">
                      <p className="text-[10px] text-[color:var(--theme-muted)]">配送状态</p>
                      <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeClass(deliveryStatusMap[order.id] ?? "待创建")}`}>{deliveryStatusMap[order.id] ?? "待创建"}</span>
                    </div>
                    <div className="rounded-2xl bg-black/3 px-3 py-3 dark:bg-white/5 col-span-2">
                      <p className="text-[10px] text-[color:var(--theme-muted)]">订单金额</p>
                      <p className="mt-1 text-lg font-black text-primary">{order.currency === "SGD" ? "S$" : "RM"} {Number(order.total).toFixed(2)}</p>
                    </div>
                    {["created", "payment_failed"].includes(order.status) ? (
                      <button
                        type="button"
                        onClick={() => void retryPayment(order.id)}
                        disabled={retryingOrderId === order.id}
                        className="col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/30 px-4 py-3 text-xs font-black text-primary transition hover:bg-primary/10 disabled:opacity-60"
                      >
                        {retryingOrderId === order.id ? "创建中..." : "重新支付"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="hidden min-w-full text-left text-sm md:table">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                  <th className="px-4 py-3">订单号</th>
                  <th className="px-4 py-3">订单状态</th>
                  <th className="px-4 py-3">配送状态</th>
                  <th className="px-4 py-3">金额</th>
                  <th className="px-4 py-3">下单时间</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 text-slate-700 last:border-0 dark:border-slate-800 dark:text-slate-200">
                    <td className="px-4 py-3 font-bold">{order.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3">{order.status}</td>
                    <td className="px-4 py-3">{deliveryStatusMap[order.id] ?? "待创建"}</td>
                    <td className="px-4 py-3">{order.currency === "SGD" ? "S$" : "RM"} {Number(order.total).toFixed(2)}</td>
                    <td className="px-4 py-3">{new Date(order.created_at).toLocaleString("zh-CN")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/member/orders/delivery?order=${encodeURIComponent(order.id)}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-primary/30 text-primary transition hover:bg-primary/10"
                          aria-label="查看追踪"
                          title="查看追踪"
                        >
                          <span className="material-symbols-outlined text-base">track_changes</span>
                        </Link>
                        {["created", "payment_failed"].includes(order.status) ? (
                          <button
                            type="button"
                            onClick={() => void retryPayment(order.id)}
                            disabled={retryingOrderId === order.id}
                            className="rounded-md border border-primary/30 px-2 py-1 text-[11px] font-black text-primary transition hover:bg-primary/10 disabled:opacity-60"
                          >
                            {retryingOrderId === order.id ? "创建中..." : "重新支付"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={6}>
                      暂无外卖订单
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </MemberShell>
  );
}
