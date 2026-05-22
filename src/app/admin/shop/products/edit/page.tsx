"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createOfficialSoupPackVariantImage,
  deleteOfficialSoupPackVariant,
  deleteOfficialSoupPackVariantImage,
  fetchOfficialSoupPackVariantById,
  fetchOfficialSoupPackVariantImages,
  updateOfficialSoupPackVariant,
} from "@/lib/admin/official-shop";
import { AdminConfirmModal } from "@/components/admin-confirm-modal";
import { AdminFilePicker } from "@/components/admin-file-picker";
import { supabase } from "@/lib/supabase";

function AdminShopProductEditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "shop";
  const id = searchParams.get("id") || "";

  const [loaded, setLoaded] = useState<null | {
    id: string;
    sku: string;
    title: string;
    subtitle: string | null;
    image_url?: string | null;
    usage_text?: string | null;
    storage_text?: string | null;
    notice_text?: string | null;
    weight_kg: number;
    stock: number;
    status: "draft" | "pending_review" | "active";
    tags: string[];
    prices: Partial<Record<"MYR" | "SGD", number>>;
  }>(null);

  const fallback = useMemo(
    () => ({
      id,
      sku: id || "-",
      title: id ? "未找到该商品" : "请选择商品",
      subtitle: "",
      status: "草稿" as const,
      stock: 0,
      prices: { MYR: 0, SGD: 0 },
      tags: [] as string[],
    }),
    [id],
  );

  const [title, setTitle] = useState(fallback.title);
  const [subtitle, setSubtitle] = useState(fallback.subtitle);
  const [imageUrl, setImageUrl] = useState("");
  const [gallery, setGallery] = useState<Array<{ id: string; url: string; sort: number }> | null>(null);
  const [weightKg, setWeightKg] = useState("0");
  const [stock, setStock] = useState(String(fallback.stock));
  const [myr, setMyr] = useState(String(fallback.prices.MYR));
  const [sgd, setSgd] = useState(String(fallback.prices.SGD));
  const [status, setStatus] = useState<"上架" | "待审核" | "草稿">("草稿");
  const [tagsText, setTagsText] = useState("");
  const [usageText, setUsageText] = useState("");
  const [storageText, setStorageText] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [saved, setSaved] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteImageId, setConfirmDeleteImageId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchOfficialSoupPackVariantById(id).then((data) => {
      if (!active || !data) return;
      setLoaded(data);
      setTitle(data.title);
      setSubtitle(data.subtitle ?? "");
      setImageUrl(data.image_url ?? "");
      setUsageText(data.usage_text ?? "");
      setStorageText(data.storage_text ?? "");
      setNoticeText(data.notice_text ?? "");
      setWeightKg(String(data.weight_kg ?? 0));
      setStock(String(data.stock));
      setMyr(String(data.prices.MYR ?? 0));
      setSgd(String(data.prices.SGD ?? 0));
      setTagsText((data.tags ?? []).join("，"));
      if (data.status === "active") setStatus("上架");
      else if (data.status === "pending_review") setStatus("待审核");
      else setStatus("草稿");
    });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchOfficialSoupPackVariantImages(id).then((rows) => {
      if (!active) return;
      setGallery(rows);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const headerTitle = loaded?.title ?? fallback.title;
  const headerSku = loaded?.sku ?? fallback.sku;
  const headerStatus = status;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">PRODUCT DETAIL</p>
            <h1 className="mt-1 text-3xl font-black">{headerTitle}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              SKU {headerSku} · {headerStatus}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/shop/products?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
            >
              返回列表
            </Link>
            <button
              type="button"
              disabled={deleting || saving || !id}
              onClick={async () => {
                if (!id || deleting || saving) return;
                setConfirmDeleteOpen(true);
              }}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:hover:bg-red-900/20"
            >
              {deleting ? "删除中..." : "删除"}
            </button>
            <button
              type="button"
              disabled={saving || !id}
              onClick={async () => {
                if (!id || saving) return;
                setSaving(true);
                setSaved(null);
                const mappedStatus =
                  status === "上架" ? "active" : status === "待审核" ? "pending_review" : ("draft" as const);
                const result = await updateOfficialSoupPackVariant({
                  id,
                  title,
                  subtitle,
                  imageUrl,
                  usageText,
                  storageText,
                  noticeText,
                  weightKg,
                  status: mappedStatus,
                  stock,
                  tagsText,
                  myr,
                  sgd,
                });
                setSaving(false);
                if (!result.ok) {
                  setSaved(`保存失败：${result.message}`);
                  return;
                }
                setSaved(`已保存：${new Date().toLocaleTimeString()}`);
                router.push(`/admin/shop/products?channel=${channel}&t=${Date.now()}`);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
        {saved && <p className="mt-3 text-xs font-bold text-primary">{saved}</p>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">基础信息</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">商品名称</p>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">副标题</p>
              <input
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">重量 (kg)</p>
              <input
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                inputMode="decimal"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">商品主图</p>
              <AdminFilePicker
                className="mt-2"
                onSelect={async (files) => {
                  const file = files[0];
                  if (!file || !id || !supabase) return;
                  const ext = file.name.split(".").pop() || "jpg";
                  const path = `products/${id}/${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
                  if (error) return;
                  const { data } = supabase.storage.from("media").getPublicUrl(path);
                  setImageUrl(data.publicUrl);
                }}
              />
              {imageUrl ? (
                <div className="mt-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  <Image src={imageUrl} alt="预览" width={128} height={128} className="h-32 w-32 rounded-lg object-cover" unoptimized />
                </div>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">商品图片（多张）</p>
              <AdminFilePicker
                className="mt-2"
                multiple
                onSelect={async (files) => {
                  if (files.length === 0 || !id || !supabase) return;
                  const baseSort = Math.max(-1, ...(gallery ?? []).map((x) => Number(x.sort))) + 1;
                  for (let i = 0; i < files.length; i += 1) {
                    const file = files[i];
                    const ext = file.name.split(".").pop() || "jpg";
                    const path = `products/${id}/gallery/${Date.now()}_${i}.${ext}`;
                    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
                    if (error) continue;
                    const { data } = supabase.storage.from("media").getPublicUrl(path);
                    const created = await createOfficialSoupPackVariantImage({ variantId: id, url: data.publicUrl, sort: baseSort + i });
                    if (!created.ok) continue;
                    setGallery((prev) => [...(prev ?? []), { id: created.id, url: data.publicUrl, sort: baseSort + i }]);
                  }
                }}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {(gallery ?? []).length === 0 ? (
                  <span className="text-sm text-slate-500 dark:text-slate-300">暂无图片</span>
                ) : (
                  (gallery ?? [])
                    .slice()
                    .sort((a, b) => Number(a.sort) - Number(b.sort))
                    .map((img) => (
                      <div key={img.id} className="relative">
                        <Image src={img.url} alt="" width={80} height={80} className="h-20 w-20 rounded-lg object-cover" unoptimized />
                        <button
                          type="button"
                          onClick={async () => {
                            setConfirmDeleteImageId(img.id);
                          }}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-red-300 bg-white text-red-600 hover:bg-red-50 dark:border-red-700 dark:bg-slate-900"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">库存</p>
              <input
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                inputMode="numeric"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">状态</p>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="上架">上架</option>
                <option value="待审核">待审核</option>
                <option value="草稿">草稿</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">标签（中文逗号分隔）</p>
              <input
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">产品说明</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">用于前台详情页展示：食用方法、保存方法、温馨提示等。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">食用方法</p>
              <textarea
                value={usageText}
                onChange={(e) => setUsageText(e.target.value)}
                className="mt-2 h-28 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">保存方法</p>
              <textarea
                value={storageText}
                onChange={(e) => setStorageText(e.target.value)}
                className="mt-2 h-28 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">温馨提示</p>
              <textarea
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                className="mt-2 h-24 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">多币种定价</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">支持马币 RM 与新币 S$ 并行定价，可用于跨境订单。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">MYR (RM)</p>
              <input
                value={myr}
                onChange={(event) => setMyr(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                inputMode="decimal"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">SGD (S$)</p>
              <input
                value={sgd}
                onChange={(event) => setSgd(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                inputMode="decimal"
              />
            </div>
          </div>
        </article>
      </section>

      <AdminConfirmModal
        open={confirmDeleteOpen}
        title={`确定删除商品「${headerTitle}」？`}
        description="删除后不可恢复，商品将从列表中移除。"
        loading={deleting}
        onCancel={() => {
          if (deleting) return;
          setConfirmDeleteOpen(false);
        }}
        onConfirm={async () => {
          if (!id || deleting) return;
          setDeleting(true);
          setSaved(null);
          const result = await deleteOfficialSoupPackVariant(id);
          setDeleting(false);
          if (!result.ok) {
            setSaved(`删除失败：${result.message}`);
            return;
          }
          setConfirmDeleteOpen(false);
          router.push(`/admin/shop/products?channel=${channel}&t=${Date.now()}`);
        }}
      />

      <AdminConfirmModal
        open={Boolean(confirmDeleteImageId)}
        title="确定删除这张图片？"
        description="删除后不可恢复。"
        confirmLabel="确认删除图片"
        onCancel={() => setConfirmDeleteImageId(null)}
        onConfirm={async () => {
          const imageId = confirmDeleteImageId;
          if (!imageId) return;
          const result = await deleteOfficialSoupPackVariantImage(imageId);
          if (!result.ok) return;
          setGallery((prev) => (prev ?? []).filter((x) => x.id !== imageId));
          setConfirmDeleteImageId(null);
        }}
      />
    </div>
  );
}

export default function AdminShopProductEditPage() {
  return (
    <Suspense fallback={null}>
      <AdminShopProductEditPageContent />
    </Suspense>
  );
}
