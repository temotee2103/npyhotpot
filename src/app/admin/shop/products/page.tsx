"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  createOfficialSoupPackVariantDraft,
  deleteOfficialSoupPackVariant,
  fetchOfficialSoupPackVariants,
  type OfficialSoupPackVariant,
} from "@/lib/admin/official-shop";
import { AdminConfirmModal } from "@/components/admin-confirm-modal";

function AdminShopProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "shop";
  const [rows, setRows] = useState<OfficialSoupPackVariant[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetchOfficialSoupPackVariants().then((data) => {
      if (!active) return;
      setRows(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const statusLabel = useMemo(() => {
    return (status: OfficialSoupPackVariant["status"]) => {
      if (status === "active") return "上架";
      if (status === "pending_review") return "待审核";
      return "草稿";
    };
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">商品管理（多币种）</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">每个商品支持 MYR/SGD 定价，并可被 Bundle Set 复用。</p>
          </div>
          <button
            disabled={creating}
            onClick={async () => {
              if (creating) return;
              setCreating(true);
              const created = await createOfficialSoupPackVariantDraft();
              setCreating(false);
              if (!created) return;
              router.push(`/admin/shop/products/edit?id=${created.id}&channel=${channel}`);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {creating ? "创建中..." : "新增商品"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-xl font-black">商品列表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">商品</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">重量(kg)</th>
                <th className="px-5 py-3">库存</th>
                <th className="px-5 py-3">MYR</th>
                <th className="px-5 py-3">SGD</th>
                <th className="px-5 py-3 w-[84px]">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((product) => (
                <tr key={product.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 font-semibold">
                    <div className="max-w-[420px]">
                      <p
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                        title={product.title}
                      >
                        {product.title}
                      </p>
                      <p
                        className="mt-1 text-xs text-slate-500 dark:text-slate-300"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                        title={product.subtitle ?? ""}
                      >
                        {product.subtitle}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3 max-w-[200px] text-slate-500 dark:text-slate-300">
                    <span className="block truncate" title={product.sku}>
                      {product.sku}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">{Number(product.weight_kg ?? 0).toFixed(3)}</td>
                  <td className="px-5 py-3">{product.stock}</td>
                  <td className="px-5 py-3">{typeof product.prices.MYR === "number" ? `RM ${product.prices.MYR.toFixed(2)}` : "-"}</td>
                  <td className="px-5 py-3">{typeof product.prices.SGD === "number" ? `S$ ${product.prices.SGD.toFixed(2)}` : "-"}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className="inline-flex h-6 min-w-[56px] items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-bold text-primary">
                      {statusLabel(product.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/shop/products/edit?id=${product.id}&channel=${channel}`}
                        className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                      >
                        编辑
                      </Link>
                      <button
                        type="button"
                        disabled={deletingId === product.id}
                        onClick={async () => {
                          if (deletingId) return;
                          setConfirmTarget({ id: product.id, title: product.title });
                        }}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:hover:bg-red-900/20"
                      >
                        {deletingId === product.id ? "删除中..." : "删除"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={8}>
                    暂无数据
                  </td>
                </tr>
              )}
              {rows === null && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={8}>
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
        title={`确定删除商品「${confirmTarget?.title ?? ""}」？`}
        description="删除后不可恢复。"
        loading={Boolean(confirmTarget && deletingId === confirmTarget.id)}
        onCancel={() => {
          if (deletingId) return;
          setConfirmTarget(null);
        }}
        onConfirm={async () => {
          if (!confirmTarget || deletingId) return;
          setDeletingId(confirmTarget.id);
          const result = await deleteOfficialSoupPackVariant(confirmTarget.id);
          setDeletingId(null);
          if (!result.ok) return;
          setRows((prev) => (prev ?? []).filter((p) => p.id !== confirmTarget.id));
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}

export default function AdminShopProductsPage() {
  return (
    <Suspense fallback={null}>
      <AdminShopProductsPageContent />
    </Suspense>
  );
}
