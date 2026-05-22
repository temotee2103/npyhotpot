"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { UnifiedTable } from "@/components/unified-table";

type AccrualRow = {
  id: string;
  member_user_id: string;
  merchant_id: string;
  outlet_id: string;
  spend_amount: number;
  points_amount: number;
  receipt_url: string;
  status: "submitted" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  reject_reason: string | null;
};

export default function AdminRewardsAccrualsPage() {
  const [rows, setRows] = useState<AccrualRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "submitted" | "approved" | "rejected">("submitted");

  const reload = async () => {
    if (!supabase) {
      setRows([]);
      return;
    }
    const query = supabase
      .from("official_member_rewards_accruals")
      .select("id,member_user_id,merchant_id,outlet_id,spend_amount,points_amount,receipt_url,status,submitted_at,reviewed_at,reject_reason")
      .order("submitted_at", { ascending: false })
      .limit(200);
    const { data } = await query;
    setRows((data ?? []) as AccrualRow[]);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const visibleRows = useMemo(() => {
    if (filter === "all") return rows ?? [];
    return (rows ?? []).filter((row) => row.status === filter);
  }, [filter, rows]);

  const review = async (row: AccrualRow, action: "approve" | "reject") => {
    if (!supabase || busyId) return;
    const rejectReason = action === "reject" ? window.prompt("请输入驳回原因") ?? "" : "";
    if (action === "reject" && !rejectReason.trim()) {
      setMessage("驳回必须填写原因");
      return;
    }
    setBusyId(row.id);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke("rewards-accrual-review", {
      body: {
        accrualId: row.id,
        action,
        rejectReason: rejectReason.trim() || undefined,
      },
    });
    setBusyId(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage((data as { message?: string } | null)?.message ?? "处理完成");
    await reload();
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black">会员积分审批</h1>
          <a href="/merchant/rewards/scan" target="_blank" rel="noreferrer" className="rounded-lg border border-primary/40 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10">
            打开 Merchant 提报页
          </a>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">审核商户扫码提报记录，通过后才会累计积分与会员消费。</p>
      </section>

      <UnifiedTable
        toolbar={
          <div className="flex flex-wrap gap-2">
            {[
              { key: "submitted", label: "待审批" },
              { key: "approved", label: "已通过" },
              { key: "rejected", label: "已驳回" },
              { key: "all", label: "全部" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key as typeof filter)}
                className={`rounded-lg border px-3 py-1 text-xs font-bold ${filter === tab.key ? "border-primary bg-primary/10 text-primary" : "border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-300"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      >
        {message ? <p className="mt-3 text-xs font-bold text-primary">{message}</p> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-3">提交时间</th>
                <th className="px-4 py-3">会员ID</th>
                <th className="px-4 py-3">消费金额</th>
                <th className="px-4 py-3">积分</th>
                <th className="px-4 py-3">单据</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">{new Date(row.submitted_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold">{row.member_user_id}</td>
                  <td className="px-4 py-3">RM {Number(row.spend_amount).toFixed(2)}</td>
                  <td className="px-4 py-3">{Number(row.points_amount).toFixed(0)}</td>
                  <td className="px-4 py-3">
                    <a href={row.receipt_url} target="_blank" rel="noreferrer" className="text-primary underline">
                      查看单据
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{row.status}</span>
                    {row.status === "rejected" && row.reject_reason ? <p className="mt-1 text-xs text-rose-600">{row.reject_reason}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    {row.status === "submitted" ? (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void review(row, "approve")}
                          className="rounded-md border border-emerald-400 px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
                        >
                          通过
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void review(row, "reject")}
                          className="rounded-md border border-rose-400 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        >
                          驳回
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">已处理</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows === null && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                    加载中...
                  </td>
                </tr>
              )}
              {rows !== null && visibleRows.length === 0 && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                    暂无数据
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
