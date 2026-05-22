"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  createOfficialPromotionDraft,
  deleteOfficialPromotion,
  fetchOfficialPromotionsByChannel,
  type OfficialPromotion,
} from "@/lib/admin/official-platform";
import { AdminConfirmModal } from "@/components/admin-confirm-modal";
import { UnifiedTable } from "@/components/unified-table";

function AdminDeliveryPromotionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";

  const [rows, setRows] = useState<OfficialPromotion[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetchOfficialPromotionsByChannel("delivery").then((data) => {
      if (!active) return;
      setRows(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const formatStatus = useMemo(() => {
    return (status: OfficialPromotion["status"]) => {
      if (status === "active") return "进行中";
      if (status === "scheduled") return "待开始";
      if (status === "paused") return "已暂停";
      if (status === "ended") return "已结束";
      return "草稿";
    };
  }, []);

  const formatSchedule = useMemo(() => {
    return (p: OfficialPromotion) => {
      if (p.schedule_kind === "daily_window") return p.daily_start && p.daily_end ? `每日 ${p.daily_start}-${p.daily_end}` : "每日";
      if (p.schedule_kind === "weekly") return p.weekly_days?.length ? `每周 ${p.weekly_days.join(",")}` : "每周";
      if (p.starts_at && p.ends_at) return `${new Date(p.starts_at).toLocaleDateString()} - ${new Date(p.ends_at).toLocaleDateString()}`;
      return "-";
    };
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">DELIVERY</p>
            <h1 className="mt-1 text-3xl font-black">促销活动</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">独立于商城的外卖促销模块（仅影响外卖前台展示）。</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/delivery?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
            >
              返回
            </Link>
            <button
              type="button"
              disabled={creating}
              onClick={async () => {
                if (creating) return;
                setCreating(true);
                const created = await createOfficialPromotionDraft("delivery");
                setCreating(false);
                if (!created) return;
                router.push(`/admin/delivery/promotions/edit?id=${created.id}&channel=${channel}`);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {creating ? "创建中..." : "新增促销"}
            </button>
          </div>
        </div>
      </section>

      <UnifiedTable title="活动清单">
        <div>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">活动</th>
                <th className="px-5 py-3">周期</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((item) => (
                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 font-semibold">{item.title}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">{formatSchedule(item)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        item.status === "active"
                          ? "bg-primary/10 text-primary"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {formatStatus(item.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/delivery/promotions/edit?id=${item.id}&channel=${channel}`}
                        className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                      >
                        编辑
                      </Link>
                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={async () => {
                          if (deletingId) return;
                          setConfirmTarget({ id: item.id, title: item.title });
                        }}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:hover:bg-red-900/20"
                      >
                        {deletingId === item.id ? "删除中..." : "删除"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300">
                    暂无数据
                  </td>
                </tr>
              )}
              {rows === null && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300">
                    加载中...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </UnifiedTable>

      <AdminConfirmModal
        open={Boolean(confirmTarget)}
        title={`确定删除促销「${confirmTarget?.title ?? ""}」？`}
        description="删除后不可恢复。"
        loading={Boolean(confirmTarget && deletingId === confirmTarget.id)}
        onCancel={() => {
          if (deletingId) return;
          setConfirmTarget(null);
        }}
        onConfirm={async () => {
          if (!confirmTarget || deletingId) return;
          setDeletingId(confirmTarget.id);
          const result = await deleteOfficialPromotion(confirmTarget.id);
          setDeletingId(null);
          if (!result.ok) return;
          setRows((prev) => (prev ?? []).filter((x) => x.id !== confirmTarget.id));
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}

export default function AdminDeliveryPromotionsPage() {
  return (
    <Suspense fallback={null}>
      <AdminDeliveryPromotionsPageContent />
    </Suspense>
  );
}
