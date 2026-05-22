"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createOfficialShopBannerDraft, deleteOfficialShopBanner, fetchOfficialShopBannersAdmin, type OfficialShopBanner } from "@/lib/admin/official-shop";
import { AdminConfirmModal } from "@/components/admin-confirm-modal";

function AdminShopBannersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "shop";
  const [rows, setRows] = useState<OfficialShopBanner[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetchOfficialShopBannersAdmin().then((data) => {
      if (!active) return;
      setRows(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const sorted = useMemo(() => {
    return [...(rows ?? [])].sort((a, b) => (a.sort - b.sort) || b.created_at.localeCompare(a.created_at));
  }, [rows]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">SHOP</p>
            <h1 className="mt-1 text-3xl font-black">限时优惠</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">用于 /shop 顶部轮播区</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/shop?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10"
            >
              返回
            </Link>
            <button
              type="button"
              disabled={creating}
              onClick={async () => {
                if (creating) return;
                setCreating(true);
                const created = await createOfficialShopBannerDraft();
                setCreating(false);
                if (!created) return;
                router.push(`/admin/shop/banners/edit?id=${created.id}&channel=${channel}`);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              {creating ? "创建中..." : "新增Banner"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h2 className="text-xl font-black">Banner 列表</h2>
        <div className="mt-4 space-y-2">
          {sorted.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{b.title}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${
                      b.is_active ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {b.is_active ? "启用" : "草稿"}
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    sort: {b.sort}
                  </span>
                </div>
                {b.subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-300 line-clamp-2">{b.subtitle}</p> : null}
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/admin/shop/banners/edit?id=${b.id}&channel=${channel}`}
                  className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10"
                >
                  编辑
                </Link>
                <button
                  type="button"
                  disabled={deletingId === b.id}
                  onClick={async () => {
                    if (deletingId) return;
                    setConfirmTarget({ id: b.id, title: b.title });
                  }}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:hover:bg-red-900/20"
                >
                  {deletingId === b.id ? "删除中..." : "删除"}
                </button>
              </div>
            </div>
          ))}
          {rows && rows.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-300">暂无 Banner</p>}
          {rows === null && <p className="text-sm text-slate-500 dark:text-slate-300">加载中...</p>}
        </div>
      </section>

      <AdminConfirmModal
        open={Boolean(confirmTarget)}
        title={`确定删除 Banner「${confirmTarget?.title ?? ""}」？`}
        description="删除后不可恢复。"
        loading={Boolean(confirmTarget && deletingId === confirmTarget.id)}
        onCancel={() => {
          if (deletingId) return;
          setConfirmTarget(null);
        }}
        onConfirm={async () => {
          if (!confirmTarget || deletingId) return;
          setDeletingId(confirmTarget.id);
          const result = await deleteOfficialShopBanner(confirmTarget.id);
          setDeletingId(null);
          if (!result.ok) return;
          setRows((prev) => (prev ?? []).filter((x) => x.id !== confirmTarget.id));
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}

export default function AdminShopBannersPage() {
  return (
    <Suspense fallback={null}>
      <AdminShopBannersPageContent />
    </Suspense>
  );
}
