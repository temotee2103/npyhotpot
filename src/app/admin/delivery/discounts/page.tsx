"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { deleteOfficialDiscount, fetchOfficialDiscounts, type OfficialDiscount } from "@/lib/admin/official-shop";
import { AdminConfirmModal } from "@/components/admin-confirm-modal";
import { UnifiedTable } from "@/components/unified-table";

function AdminDeliveryDiscountsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";
  const [rows, setRows] = useState<OfficialDiscount[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetchOfficialDiscounts("delivery").then((data) => {
      if (!active) return;
      setRows(data);
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
            <h1 className="text-3xl font-black">外送优惠券管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">支持优惠券（Code）与订单内手工输入折扣。</p>
          </div>
          <button
            disabled={creating}
            onClick={async () => {
              if (creating) return;
              setCreating(true);
              setCreating(false);
              router.push(`/admin/delivery/discounts/edit?new=1&channel=${channel}`);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {creating ? "创建中..." : "新增优惠券"}
          </button>
        </div>
      </section>

      <UnifiedTable title="优惠券列表">
        <div>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">标题</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">类型</th>
                <th className="px-5 py-3">规则</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((discount) => (
                <tr key={discount.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 font-semibold">{discount.title}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">{discount.code}</td>
                  <td className="px-5 py-3">{discount.discount_type === "percent" ? "百分比" : "固定金额"}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">
                    {discount.discount_type === "percent"
                      ? `${discount.percent_off ?? 0}%`
                      : `RM ${discount.myr_amount_off?.toFixed(0) ?? 0} / S$ ${discount.sgd_amount_off?.toFixed(0) ?? 0}`}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{discount.status === "enabled" ? "启用" : "停用"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/delivery/discounts/edit?id=${discount.id}&channel=${channel}`}
                        className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                      >
                        编辑
                      </Link>
                      <button
                        type="button"
                        disabled={deletingId === discount.id}
                        onClick={async () => {
                          if (deletingId) return;
                          setConfirmTarget({ id: discount.id, title: discount.title });
                        }}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:hover:bg-red-900/20"
                      >
                        {deletingId === discount.id ? "删除中..." : "删除"}
                      </button>
                    </div>
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

      <AdminConfirmModal
        open={Boolean(confirmTarget)}
        title={`确定删除优惠券「${confirmTarget?.title ?? ""}」？`}
        description="删除后不可恢复。"
        loading={Boolean(confirmTarget && deletingId === confirmTarget.id)}
        onCancel={() => {
          if (deletingId) return;
          setConfirmTarget(null);
        }}
        onConfirm={async () => {
          if (!confirmTarget || deletingId) return;
          setDeletingId(confirmTarget.id);
          const result = await deleteOfficialDiscount(confirmTarget.id, "delivery");
          setDeletingId(null);
          if (!result.ok) return;
          setRows((prev) => (prev ?? []).filter((d) => d.id !== confirmTarget.id));
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}

export default function AdminDeliveryDiscountsPage() {
  return (
    <Suspense fallback={null}>
      <AdminDeliveryDiscountsPageContent />
    </Suspense>
  );
}
