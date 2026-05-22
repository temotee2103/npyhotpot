"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { timelineTone } from "@/lib/admin/delivery-ui";
import {
  fetchAdminDeliveryOrderManagementRows,
  fetchOfficialOrderItems,
  type AdminDeliveryOrderManagementRow,
  type OfficialOrderItemRow,
} from "@/lib/admin/official-orders";

function formatDateTime(text: string | null | undefined) {
  if (!text) return "-";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function normalizePhoneForWhatsapp(phone: string | null | undefined) {
  const raw = (phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}

function getDeliveryShareLink(row: AdminDeliveryOrderManagementRow | null) {
  if (!row) return "";
  const payload = row.delivery?.provider_payload as
    | { data?: { shareLink?: string }; shareLink?: string }
    | null
    | undefined;
  const fromPayload = payload?.data?.shareLink ?? payload?.shareLink ?? "";
  if (fromPayload) return fromPayload;
  const orderId = row.delivery?.lalamove_order_id ?? "";
  if (!orderId) return "";
  return `https://share.lalamove.com/?${orderId}`;
}

function AdminDeliveryOrderDetailPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [rows, setRows] = useState<AdminDeliveryOrderManagementRow[] | null>(null);
  const [orderItems, setOrderItems] = useState<OfficialOrderItemRow[] | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const run = async () => {
      const [data, items] = await Promise.all([fetchAdminDeliveryOrderManagementRows(300), fetchOfficialOrderItems(id)]);
      if (!active) return;
      setRows(data);
      setOrderItems(items);
    };
    void run();
    return () => {
      active = false;
    };
  }, [id]);

  const row = useMemo(() => (rows ?? []).find((x) => x.order.id === id) ?? null, [id, rows]);
  const sstAmount = useMemo(() => (row ? Number(row.order.subtotal) * 0.06 : 0), [row]);
  const whatsappUrl = useMemo(() => {
    if (!row) return "";
    const phone = normalizePhoneForWhatsapp(row.order.ship_phone);
    if (!phone) return "";
    const share = getDeliveryShareLink(row);
    const text = [
      `Hi ${row.order.ship_full_name ?? "Customer"},`,
      `您的配送订单 ${row.order.id} 正在处理。`,
      share ? `配送追踪：${share}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }, [row]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">DELIVERY ORDER DETAIL</p>
            <h1 className="mt-1 text-3xl font-black">{id || "-"}</h1>
          </div>
          <Link href="/admin/delivery/orders" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10">
            返回列表
          </Link>
        </div>
      </section>

      {!rows ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          加载中...
        </section>
      ) : !row ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          未找到对应订单
        </section>
      ) : (
        <section className="mx-auto grid max-w-5xl gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
            <h2 className="text-xl font-black">基础信息</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-300">客户名字</span>
                <span className="font-bold">{row.order.ship_full_name ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-300">联系号码</span>
                <span className="font-bold">{row.order.ship_phone ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-300">支付状态</span>
                <span className="font-bold">{row.payment?.status ?? "no_payment"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-300">配送状态</span>
                <span className="font-bold">{row.delivery?.status ?? "not_created"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-300">配送单号</span>
                <span className="font-bold">{row.delivery?.lalamove_order_id ?? "-"}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-300">收件地址</p>
                <p className="mt-1">{row.order.ship_address ?? "-"}</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
            <h2 className="text-xl font-black">运营动作</h2>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(row.order.id);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
              >
                复制订单号
              </button>
              <button
                type="button"
                onClick={async () => {
                  const share = getDeliveryShareLink(row);
                  if (!share) return;
                  await navigator.clipboard.writeText(share);
                }}
                className="w-full rounded-lg border border-primary/40 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10"
              >
                复制配送链接
              </button>
              <a
                href={whatsappUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-bold ${
                  whatsappUrl
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "pointer-events-none bg-slate-300 text-slate-500 opacity-60"
                }`}
              >
                WhatsApp 联系客户
              </a>
            </div>
          </article>

          <article className="md:col-span-2 rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
            <h2 className="text-xl font-black">Receipt</h2>
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="mb-3 flex items-center justify-between border-b border-dashed border-slate-300 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-300">
                <span>Item</span>
                <span>Amount</span>
              </div>
              {!orderItems ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">加载中...</p>
              ) : orderItems.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">暂无商品明细</p>
              ) : (
                <>
                  {orderItems.map((item) => {
                    const unitPrice = Number(item.unit_price ?? 0);
                    const lineTotal = unitPrice * Number(item.quantity ?? 0);
                    const currencySymbol = row.order.currency === "SGD" ? "S$" : "RM";
                    return (
                      <div key={item.id} className="mb-2 flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-2 text-sm last:mb-0 dark:border-slate-700">
                        <div className="min-w-0">
                          <p className="font-bold">{item.title ?? item.item_id}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">
                            {currencySymbol} {unitPrice.toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <p className="shrink-0 font-bold">
                          {currencySymbol} {lineTotal.toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                  <div className="mt-3 space-y-1.5 border-t border-slate-300 pt-3 text-sm dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Subtotal</span>
                      <span>{row.order.currency === "SGD" ? "S$" : "RM"} {Number(row.order.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Shipping</span>
                      <span>{row.order.currency === "SGD" ? "S$" : "RM"} {Number(row.order.shipping_fee).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-300">SST 6%</span>
                      <span>{row.order.currency === "SGD" ? "S$" : "RM"} {sstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-300">Discount</span>
                      <span>-{row.order.currency === "SGD" ? "S$" : "RM"} {Number(row.order.discount_total).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-300 pt-2 text-base font-black dark:border-slate-700">
                      <span>Total</span>
                      <span>{row.order.currency === "SGD" ? "S$" : "RM"} {Number(row.order.total).toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </article>

          <article className="md:col-span-2 rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
            <h2 className="text-xl font-black">配送轨迹</h2>
            <div className="mt-4 space-y-0">
              {row.events.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">暂无轨迹</p>
              ) : (
                row.events.map((event, index) => {
                  const tone = timelineTone(event.provider_status ?? event.step);
                  const isLast = index === row.events.length - 1;
                  return (
                    <div key={event.id} className="grid grid-cols-[24px_1fr] gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`mt-1 h-3.5 w-3.5 rounded-full ring-4 ${tone.dot}`} />
                        {!isLast ? <span className={`mt-1 w-px flex-1 bg-gradient-to-b ${tone.line}`} /> : null}
                      </div>
                      <div className={`${!isLast ? "pb-4" : "pb-0"}`}>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.badge}`}>{event.step}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-300">{formatDateTime(event.created_at)}</span>
                          </div>
                          {event.provider_status ? (
                            <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                              Provider: {event.provider_status}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

export default function AdminDeliveryOrderDetailPage() {
  return (
    <Suspense fallback={null}>
      <AdminDeliveryOrderDetailPageContent />
    </Suspense>
  );
}
