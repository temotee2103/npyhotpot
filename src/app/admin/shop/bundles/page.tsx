"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createOfficialBundleDraft, deleteOfficialBundle, fetchOfficialBundles, type OfficialBundle } from "@/lib/admin/official-shop";
import { AdminConfirmModal } from "@/components/admin-confirm-modal";

function AdminShopBundlesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "shop";
  const [rows, setRows] = useState<OfficialBundle[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetchOfficialBundles().then((data) => {
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
            <h1 className="text-3xl font-black">套餐组合管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">支持买X送Y（同款/跨款）与客制化组合套餐（手动定价）。</p>
          </div>
          <button
            disabled={creating}
            onClick={async () => {
              if (creating) return;
              setCreating(true);
              const created = await createOfficialBundleDraft();
              setCreating(false);
              if (!created) return;
              router.push(`/admin/shop/bundles/edit?id=${created.id}&channel=${channel}`);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {creating ? "创建中..." : "新增 Bundle"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-xl font-black">Bundle 列表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">Bundle</th>
                <th className="px-5 py-3">代码</th>
                <th className="px-5 py-3">规则</th>
                <th className="px-5 py-3">定价</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((bundle) => (
                <tr key={bundle.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 font-semibold">{bundle.title}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">{bundle.code}</td>
                  <td className="px-5 py-3">
                    {bundle.rule_kind === "buy_x_get_y"
                      ? `买 ${bundle.buy_qty ?? 0} 送 ${bundle.free_qty ?? 0}`
                      : "自选组合（客制化）"}
                  </td>
                  <td className="px-5 py-3">{bundle.pricing_mode === "auto" ? "自动" : "手动"}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                      {bundle.status === "active" ? "上架" : "草稿"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/shop/bundles/edit?id=${bundle.id}&channel=${channel}`}
                        className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                      >
                        配置
                      </Link>
                      <button
                        type="button"
                        disabled={deletingId === bundle.id}
                        onClick={async () => {
                          if (deletingId) return;
                          setConfirmTarget({ id: bundle.id, title: bundle.title });
                        }}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:hover:bg-red-900/20"
                      >
                        {deletingId === bundle.id ? "删除中..." : "删除"}
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
      </section>

      <AdminConfirmModal
        open={Boolean(confirmTarget)}
        title={`确定删除 Bundle「${confirmTarget?.title ?? ""}」？`}
        description="删除后不可恢复。"
        loading={Boolean(confirmTarget && deletingId === confirmTarget.id)}
        onCancel={() => {
          if (deletingId) return;
          setConfirmTarget(null);
        }}
        onConfirm={async () => {
          if (!confirmTarget || deletingId) return;
          setDeletingId(confirmTarget.id);
          const result = await deleteOfficialBundle(confirmTarget.id);
          setDeletingId(null);
          if (!result.ok) return;
          setRows((prev) => (prev ?? []).filter((b) => b.id !== confirmTarget.id));
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}

export default function AdminShopBundlesPage() {
  return (
    <Suspense fallback={null}>
      <AdminShopBundlesPageContent />
    </Suspense>
  );
}
