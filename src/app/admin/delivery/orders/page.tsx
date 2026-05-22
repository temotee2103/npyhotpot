"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { timelineTone } from "@/lib/admin/delivery-ui";
import {
  fetchAdminDeliveryOrderManagementRows,
  type AdminDeliveryOrderManagementRow,
  type OfficialDeliveryEventRow,
} from "@/lib/admin/official-orders";

function getDeliveryShareLink(row: AdminDeliveryOrderManagementRow) {
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

function normalizePhoneForWhatsapp(phone: string | null | undefined) {
  const raw = (phone ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}

function formatDateTime(text: string | null | undefined) {
  if (!text) return "-";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatMoney(currency: "MYR" | "SGD", amount: number) {
  return `${currency === "SGD" ? "S$" : "RM"} ${Number(amount).toFixed(2)}`;
}

function buildWhatsappUrl(row: AdminDeliveryOrderManagementRow) {
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
}

function latestEvent(rows: OfficialDeliveryEventRow[]) {
  if (rows.length === 0) return null;
  return rows[rows.length - 1];
}

export default function AdminDeliveryOrdersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminDeliveryOrderManagementRow[] | null>(null);
  const [keyword, setKeyword] = useState("");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [syncingStatuses, setSyncingStatuses] = useState(false);
  const [redispatching, setRedispatching] = useState(false);
  const syncingStatusesRef = useRef(false);

  const loadRows = useCallback(async () => {
    const data = await fetchAdminDeliveryOrderManagementRows(200);
    setRows(data);
    setSelectedOrderId((prev) => {
      if (!data.length) return null;
      if (prev && data.some((row) => row.order.id === prev)) return prev;
      return data[0]?.order.id ?? null;
    });
  }, []);

  const syncDeliveryStatuses = useCallback(async (orderIds?: string[]) => {
    if (!supabase || syncingStatusesRef.current) return;
    syncingStatusesRef.current = true;
    setSyncingStatuses(true);
    try {
      const { data, error } = await supabase.functions.invoke("delivery-admin-sync", {
        body: {
          orderIds: orderIds?.length ? orderIds : undefined,
        },
      });
      if (error) {
        setCopyMessage(`同步失败：${error.message}`);
        window.setTimeout(() => setCopyMessage(null), 3200);
        return;
      }
      const changed = Number((data as { changed?: number } | null)?.changed ?? 0);
      setCopyMessage(`已同步配送状态，更新 ${changed} 笔`);
      window.setTimeout(() => setCopyMessage(null), 2600);
      await loadRows();
    } finally {
      syncingStatusesRef.current = false;
      setSyncingStatuses(false);
    }
  }, [loadRows]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const data = await fetchAdminDeliveryOrderManagementRows(200);
      if (!active) return;
      setRows(data);
      setSelectedOrderId((prev) => {
        if (!data.length) return null;
        if (prev && data.some((row) => row.order.id === prev)) return prev;
        return data[0]?.order.id ?? null;
      });
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    void syncDeliveryStatuses();
    const timer = window.setInterval(() => {
      void syncDeliveryStatuses();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [syncDeliveryStatuses]);

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      const deliveryStatus = row.delivery?.status ?? "not_created";
      const paymentStatus = row.payment?.status ?? "no_payment";
      const hitFilter =
        (deliveryStatusFilter === "all" || deliveryStatus === deliveryStatusFilter) &&
        (paymentStatusFilter === "all" || paymentStatus === paymentStatusFilter);
      if (!hitFilter) return false;
      if (!q) return true;
      const bucket = [
        row.order.id,
        row.order.ship_full_name ?? "",
        row.order.ship_phone ?? "",
        row.order.ship_address ?? "",
        row.delivery?.lalamove_order_id ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return bucket.includes(q);
    });
  }, [rows, keyword, deliveryStatusFilter, paymentStatusFilter]);

  const selected = useMemo(() => {
    if (!selectedOrderId) return filteredRows[0] ?? null;
    return filteredRows.find((x) => x.order.id === selectedOrderId) ?? filteredRows[0] ?? null;
  }, [filteredRows, selectedOrderId]);

  const redispatchSelected = useCallback(async () => {
    if (!supabase || !selected?.order.id || redispatching) return;
    const confirmed = window.confirm(
      `确认要为订单 ${selected.order.id} 再次触发 Lalamove 吗？\n\n当前配送状态：${selected.delivery?.status ?? "not_created"}\n此操作会尝试重新创建配送单。`,
    );
    if (!confirmed) return;
    setRedispatching(true);
    const { error } = await supabase.functions.invoke("delivery-admin-redispatch", {
      body: { officialOrderId: selected.order.id },
    });
    setRedispatching(false);
    if (error) {
      setCopyMessage(`人工重派失败：${error.message}`);
      window.setTimeout(() => setCopyMessage(null), 3600);
      return;
    }
    setCopyMessage("已触发人工重派");
    window.setTimeout(() => setCopyMessage(null), 2600);
    await loadRows();
  }, [loadRows, redispatching, selected]);

  const stats = useMemo(() => {
    const source = rows ?? [];
    return {
      total: source.length,
      awaitingDispatch: source.filter((x) => (x.delivery?.status ?? "not_created") === "requested").length,
      inTransit: source.filter((x) => x.delivery?.status === "in_transit").length,
      completed: source.filter((x) => x.delivery?.status === "completed").length,
      paymentPending: source.filter((x) => (x.payment?.status ?? "no_payment") !== "succeeded").length,
    };
  }, [rows]);

  const copyText = async (text: string, success: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(success);
      window.setTimeout(() => setCopyMessage(null), 2200);
    } catch {
      setCopyMessage("复制失败，请手动复制");
      window.setTimeout(() => setCopyMessage(null), 2200);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">外卖配送订单管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">覆盖支付状态、配送轨迹、联系客户、复制配送链接与快速运营处理。</p>
          </div>
          <button
            type="button"
            onClick={() => void syncDeliveryStatuses()}
            disabled={syncingStatuses}
            className="rounded-lg border border-primary/40 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-60"
          >
            {syncingStatuses ? "同步中..." : "同步最新配送状态"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">总订单</p>
          <p className="mt-2 text-2xl font-black">{rows ? String(stats.total) : "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">待分配</p>
          <p className="mt-2 text-2xl font-black">{rows ? String(stats.awaitingDispatch) : "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">配送中</p>
          <p className="mt-2 text-2xl font-black">{rows ? String(stats.inTransit) : "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">已完成</p>
          <p className="mt-2 text-2xl font-black">{rows ? String(stats.completed) : "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">待确认支付</p>
          <p className="mt-2 text-2xl font-black">{rows ? String(stats.paymentPending) : "-"}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <h2 className="text-xl font-black">订单列表</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索订单号/客户/电话/地址"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
              />
              <select
                value={deliveryStatusFilter}
                onChange={(event) => setDeliveryStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
              >
                <option value="all">全部配送状态</option>
                <option value="not_created">未派单</option>
                <option value="requested">requested</option>
                <option value="in_transit">in_transit</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
              <select
                value={paymentStatusFilter}
                onChange={(event) => setPaymentStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
              >
                <option value="all">全部支付状态</option>
                <option value="succeeded">succeeded</option>
                <option value="pending">pending</option>
                <option value="failed">failed</option>
                <option value="no_payment">no_payment</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-4 py-3">订单</th>
                  <th className="px-4 py-3">客户</th>
                  <th className="px-4 py-3">支付</th>
                  <th className="px-4 py-3">配送</th>
                  <th className="px-4 py-3">最近轨迹</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isActive = selected?.order.id === row.order.id;
                  const share = getDeliveryShareLink(row);
                  const wa = buildWhatsappUrl(row);
                  const recent = latestEvent(row.events);
                  return (
                    <tr
                      key={row.order.id}
                      onClick={() => setSelectedOrderId(row.order.id)}
                      className={`cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 ${
                        isActive ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold">{row.order.id}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-300">{formatDateTime(row.order.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{row.order.ship_full_name ?? "-"}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-300">{row.order.ship_phone ?? "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {row.payment?.status ?? "no_payment"}
                        </span>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                          {formatMoney(row.order.currency, row.order.total)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                          {row.delivery?.status ?? "not_created"}
                        </span>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{row.delivery?.lalamove_order_id ?? "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{recent?.step ?? "-"}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-300">{recent ? formatDateTime(recent.created_at) : "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/admin/delivery/orders/detail?id=${row.order.id}`);
                            }}
                            className="rounded-md border border-primary/40 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                          >
                            详情
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void copyText(row.order.id, "已复制订单号");
                            }}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/70"
                          >
                            复制订单号
                          </button>
                          <button
                            type="button"
                            disabled={!share}
                            onClick={(event) => {
                              event.stopPropagation();
                              void copyText(share, "已复制配送链接");
                            }}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/70"
                          >
                            复制配送链接
                          </button>
                          <a
                            href={wa || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className={`rounded-md border px-2.5 py-1 text-xs font-bold ${
                              wa
                                ? "border-emerald-400 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                                : "pointer-events-none border-slate-300 text-slate-400 opacity-50"
                            }`}
                          >
                            WhatsApp
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && rows && (
                  <tr className="border-t border-slate-100 dark:border-slate-800">
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
                      暂无符合条件的订单
                    </td>
                  </tr>
                )}
                {rows === null && (
                  <tr className="border-t border-slate-100 dark:border-slate-800">
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
                      加载中...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">订单详情</h2>
          {selected ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-300">订单号</p>
                <p className="mt-1 font-bold">{selected.order.id}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">客户</p>
                <p className="mt-1">{selected.order.ship_full_name ?? "-"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">{selected.order.ship_phone ?? "-"}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">地址</p>
                <p className="mt-1 text-sm">{selected.order.ship_address ?? "-"}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-300">支付状态</p>
                  <p className="mt-1 font-bold">{selected.payment?.status ?? "no_payment"}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{selected.payment?.gateway_ref ?? "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-300">配送状态</p>
                  <p className="mt-1 font-bold">{selected.delivery?.status ?? "not_created"}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{selected.delivery?.lalamove_order_id ?? "-"}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">配送 Timeline</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-300">按时间倒序显示最近轨迹</p>
                </div>
                <div className="mt-3 max-h-72 space-y-0 overflow-y-auto pr-1">
                  {selected.events.map((event, index) => {
                    const tone = timelineTone(event.provider_status ?? event.step);
                    const isLast = index === selected.events.length - 1;
                    return (
                      <div key={event.id} className="grid grid-cols-[22px_1fr] gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`mt-1 h-3.5 w-3.5 rounded-full ring-4 ${tone.dot}`} />
                          {!isLast ? <span className={`mt-1 w-px flex-1 bg-gradient-to-b ${tone.line}`} /> : null}
                        </div>
                        <div className={`pb-4 ${!isLast ? "" : "pb-0"}`}>
                          <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
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
                  })}
                  {selected.events.length === 0 && (
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                      暂无轨迹
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void copyText(selected.order.id, "已复制订单号")}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/70"
                >
                  复制订单号
                </button>
                <button
                  type="button"
                  onClick={() => void copyText(getDeliveryShareLink(selected), "已复制配送链接")}
                  className="rounded-lg border border-primary/40 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10"
                >
                  复制配送链接
                </button>
              </div>
              <a
                href={buildWhatsappUrl(selected) || "#"}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-bold ${
                  buildWhatsappUrl(selected)
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "pointer-events-none bg-slate-300 text-slate-500 opacity-60"
                }`}
              >
                一键联系客户 WhatsApp
              </a>
              <button
                type="button"
                onClick={() => void syncDeliveryStatuses([selected.order.id])}
                disabled={syncingStatuses}
                className="w-full rounded-lg border border-primary/40 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-60"
              >
                {syncingStatuses ? "同步中..." : "同步这笔配送状态"}
              </button>
              <button
                type="button"
                onClick={() => void redispatchSelected()}
                disabled={redispatching || !["not_created", "cancelled"].includes(selected.delivery?.status ?? "not_created")}
                className="w-full rounded-lg border border-amber-400 px-3 py-2 text-sm font-bold text-amber-600 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-500/10"
              >
                {redispatching ? "重派中..." : "人工配送 / 再次触发叫 Lalamove"}
              </button>
              {["not_created", "cancelled"].includes(selected.delivery?.status ?? "not_created") ? (
                <p className="text-xs text-slate-500 dark:text-slate-300">当配送单未创建或已取消时，可在这里一键重新触发 Lalamove。</p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-300">仅 `not_created` 或 `cancelled` 的订单允许人工重派，当前状态为 `{selected.delivery?.status ?? "not_created"}`。</p>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              请选择左侧订单查看详情
            </div>
          )}
          {copyMessage ? <p className="mt-3 text-xs font-bold text-primary">{copyMessage}</p> : null}
        </article>
      </section>
    </div>
  );
}
