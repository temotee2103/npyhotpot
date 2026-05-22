"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { UnifiedTable } from "@/components/unified-table";

type PointsLedgerRow = {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  channel: "shop" | "delivery" | "dine_in" | "all";
  event_at: string;
  points_delta: number;
  reason: "self_earn" | "upline_rebate" | "redeem_deduction" | "admin_adjustment";
  meta: Record<string, unknown> | null;
  created_at: string;
  official_profiles?: {
    full_name?: string | null;
    phone?: string | null;
    membership_tier?: string | null;
  } | null;
};

const reasonLabel: Record<PointsLedgerRow["reason"], string> = {
  self_earn: "本人消费",
  upline_rebate: "直属返利",
  redeem_deduction: "兑换扣减",
  admin_adjustment: "人工调整",
};

export default function AdminPointsLedgerPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PointsLedgerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reasonFilter, setReasonFilter] = useState<"ALL" | PointsLedgerRow["reason"]>("ALL");
  const [channelFilter, setChannelFilter] = useState<"ALL" | PointsLedgerRow["channel"]>("ALL");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!supabase) {
        if (!active) return;
        setError("Supabase 未初始化");
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await supabase
        .from("official_points_ledger")
        .select("id,user_id,source_type,source_id,channel,event_at,points_delta,reason,meta,created_at,official_profiles(full_name,phone,membership_tier)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (!active) return;
      if (res.error) {
        setError(res.error.message);
        setRows([]);
        setLoading(false);
        return;
      }
      setRows((res.data ?? []) as PointsLedgerRow[]);
      setError(null);
      setLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return rows
      .filter((row) => (reasonFilter === "ALL" ? true : row.reason === reasonFilter))
      .filter((row) => (channelFilter === "ALL" ? true : row.channel === channelFilter))
      .filter((row) => {
        if (!q) return true;
        const text = `${row.official_profiles?.full_name ?? ""} ${row.official_profiles?.phone ?? ""} ${row.user_id} ${row.source_type} ${row.source_id}`.toLowerCase();
        return text.includes(q);
      });
  }, [channelFilter, keyword, reasonFilter, rows]);

  const summary = useMemo(() => {
    const totalDelta = filteredRows.reduce((sum, row) => sum + Number(row.points_delta ?? 0), 0);
    const positiveDelta = filteredRows.filter((row) => Number(row.points_delta) > 0).reduce((sum, row) => sum + Number(row.points_delta), 0);
    const negativeDelta = filteredRows.filter((row) => Number(row.points_delta) < 0).reduce((sum, row) => sum + Number(row.points_delta), 0);
    return { count: filteredRows.length, totalDelta, positiveDelta, negativeDelta };
  }, [filteredRows]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h1 className="text-3xl font-black">积分与返利流水</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">追踪会员积分变动、直属返利与人工调整记录。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-primary/10 bg-primary/5 p-3">
            <p className="text-xs text-slate-500 dark:text-slate-300">记录数</p>
            <p className="mt-1 text-xl font-black">{summary.count}</p>
          </article>
          <article className="rounded-xl border border-primary/10 bg-primary/5 p-3">
            <p className="text-xs text-slate-500 dark:text-slate-300">总积分变化</p>
            <p className="mt-1 text-xl font-black">{summary.totalDelta.toFixed(2)}</p>
          </article>
          <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-900/20">
            <p className="text-xs text-slate-500 dark:text-slate-300">新增积分</p>
            <p className="mt-1 text-xl font-black text-emerald-600">{summary.positiveDelta.toFixed(2)}</p>
          </article>
          <article className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-900/20">
            <p className="text-xs text-slate-500 dark:text-slate-300">扣减积分</p>
            <p className="mt-1 text-xl font-black text-rose-600">{summary.negativeDelta.toFixed(2)}</p>
          </article>
        </div>
      </section>

      <UnifiedTable
        title="流水列表"
        toolbar={
          <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              placeholder="搜索姓名/手机号/UserID/来源ID"
            />
            <select
              value={reasonFilter}
              onChange={(event) => setReasonFilter(event.target.value as "ALL" | PointsLedgerRow["reason"])}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="ALL">全部类型</option>
              <option value="self_earn">本人消费</option>
              <option value="upline_rebate">直属返利</option>
              <option value="redeem_deduction">兑换扣减</option>
              <option value="admin_adjustment">人工调整</option>
            </select>
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value as "ALL" | PointsLedgerRow["channel"])}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="ALL">全部渠道</option>
              <option value="shop">商城</option>
              <option value="delivery">外卖</option>
              <option value="dine_in">门店</option>
              <option value="all">全渠道</option>
            </select>
          </div>
        }
      >
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="px-5 py-3">时间</th>
              <th className="px-5 py-3">会员</th>
              <th className="px-5 py-3">类型</th>
              <th className="px-5 py-3">渠道</th>
              <th className="px-5 py-3">积分变化</th>
              <th className="px-5 py-3">来源</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-5 py-3 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <p className="font-bold">{row.official_profiles?.full_name?.trim() || "未命名用户"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">{row.official_profiles?.phone?.trim() || row.user_id}</p>
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{reasonLabel[row.reason] ?? row.reason}</span>
                </td>
                <td className="px-5 py-3">{row.channel}</td>
                <td className={`px-5 py-3 font-black ${Number(row.points_delta) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {Number(row.points_delta) >= 0 ? "+" : ""}
                  {Number(row.points_delta).toFixed(2)}
                </td>
                <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-300">
                  <p>{row.source_type}</p>
                  <p>{row.source_id}</p>
                </td>
              </tr>
            ))}
            {!loading && filteredRows.length === 0 ? (
              <tr className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={6}>
                  {error ? `加载失败：${error}` : "暂无数据"}
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={6}>
                  加载中...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </UnifiedTable>
    </div>
  );
}

