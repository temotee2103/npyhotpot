"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchOfficialPayments, fetchPaymentCounts, type OfficialPaymentWithOrder } from "@/lib/admin/official-platform";
import { UnifiedTable } from "@/components/unified-table";

export default function AdminTransactionsPage() {
  const [counts, setCounts] = useState<null | { succeeded: number; pending: number; failed: number; superseded: number }>(null);
  const [rows, setRows] = useState<OfficialPaymentWithOrder[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchPaymentCounts(), fetchOfficialPayments(50)]).then(([c, list]) => {
      if (!active) return;
      setCounts(c);
      setRows(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const formatAmount = useMemo(() => {
    return (payment: OfficialPaymentWithOrder) => {
      const currency = payment.official_orders?.currency ?? "MYR";
      const prefix = currency === "SGD" ? "S$" : "RM";
      return `${prefix} ${Number(payment.amount).toFixed(2)}`;
    };
  }, []);

  const formatChannel = useMemo(() => {
    return (payment: OfficialPaymentWithOrder) => {
      const channel = payment.official_orders?.channel;
      if (channel === "delivery") return "外卖";
      if (channel === "shop") return "商城";
      return "-";
    };
  }, []);

  const formatStatus = useMemo(() => {
    return (status: string) => {
      if (status === "succeeded") return "成功";
      if (status === "created" || status === "pending") return "待确认";
      if (status === "failed") return "失败";
      if (status === "superseded") return "已替换";
      return status;
    };
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h1 className="text-3xl font-black">交易与支付中心</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">追踪支付状态、退款流程与异常交易拦截。</p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">成功交易</p>
          <p className="mt-2 text-2xl font-black">{counts?.succeeded ?? "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">待确认</p>
          <p className="mt-2 text-2xl font-black">{counts?.pending ?? "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">已替换</p>
          <p className="mt-2 text-2xl font-black">{counts?.superseded ?? "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">异常交易</p>
          <p className="mt-2 text-2xl font-black">{counts?.failed ?? "-"}</p>
        </article>
      </section>

      <UnifiedTable title="交易流水">
        <div>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">交易号</th>
                <th className="px-5 py-3">订单号</th>
                <th className="px-5 py-3">渠道</th>
                <th className="px-5 py-3">金额</th>
                <th className="px-5 py-3">支付方式</th>
                <th className="px-5 py-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 font-semibold">{row.gateway_ref ?? row.id}</td>
                  <td className="px-5 py-3">{row.official_orders?.id ?? "-"}</td>
                  <td className="px-5 py-3">{formatChannel(row)}</td>
                  <td className="px-5 py-3">{formatAmount(row)}</td>
                  <td className="px-5 py-3">{row.method ?? "-"}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{formatStatus(row.status)}</span>
                  </td>
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={6}>
                    暂无数据
                  </td>
                </tr>
              )}
              {rows === null && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={6}>
                    加载中...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </UnifiedTable>
    </div>
  );
}
