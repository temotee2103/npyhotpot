"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchOfficialShopBannerById, updateOfficialShopBanner } from "@/lib/admin/official-shop";
import { AdminFilePicker } from "@/components/admin-file-picker";

function AdminShopBannerEditPageContent() {
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "shop";
  const id = searchParams.get("id") || "";

  const fallback = useMemo(
    () => ({
      title: "限时优惠",
      subtitle: "",
      image_url: "",
      cta_text: "立即购买",
      cta_href: "/shop",
      sort: "0",
      is_active: false,
    }),
    [],
  );

  const [title, setTitle] = useState(fallback.title);
  const [subtitle, setSubtitle] = useState(fallback.subtitle);
  const [imageUrl, setImageUrl] = useState(fallback.image_url);
  const [ctaText, setCtaText] = useState(fallback.cta_text);
  const [ctaHref, setCtaHref] = useState(fallback.cta_href);
  const [sort, setSort] = useState(fallback.sort);
  const [status, setStatus] = useState<"启用" | "草稿">("草稿");

  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchOfficialShopBannerById(id).then((data) => {
      if (!active || !data) return;
      setTitle(data.title ?? fallback.title);
      setSubtitle(data.subtitle ?? "");
      setImageUrl(data.image_url ?? "");
      setCtaText(data.cta_text ?? "");
      setCtaHref(data.cta_href ?? "");
      setSort(String(data.sort ?? 0));
      setStatus(data.is_active ? "启用" : "草稿");
    });
    return () => {
      active = false;
    };
  }, [fallback.title, id]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">SHOP</p>
            <h1 className="mt-1 text-3xl font-black">编辑 Banner</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{id ? `ID: ${id}` : "缺少ID"}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/shop/banners?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10"
            >
              返回列表
            </Link>
            <button
              type="button"
              disabled={saving || !id}
              onClick={async () => {
                if (!id || saving) return;
                setSaving(true);
                setSaved(null);
                const result = await updateOfficialShopBanner({
                  id,
                  title,
                  subtitle,
                  imageUrl,
                  ctaText,
                  ctaHref,
                  sort,
                  isActive: status === "启用",
                });
                setSaving(false);
                if (!result.ok) {
                  setSaved(`保存失败：${result.message}`);
                  return;
                }
                setSaved("已保存");
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
        {saved ? <p className="mt-3 text-xs font-bold text-primary">{saved}</p> : null}
      </section>

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h2 className="text-xl font-black">内容</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">标题</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">副标题</p>
            <textarea
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="mt-2 h-24 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">图片</p>
            <AdminFilePicker
              className="mt-2"
              onSelect={async (files) => {
                const file = files[0];
                if (!file || !id || !supabase) return;
                const ext = file.name.split(".").pop() || "jpg";
                const path = `banners/${id}/${Date.now()}.${ext}`;
                const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
                if (error) return;
                const { data } = supabase.storage.from("media").getPublicUrl(path);
                setImageUrl(data.publicUrl);
              }}
            />
            {imageUrl ? (
              <div className="mt-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                <Image src={imageUrl} alt="预览" width={1200} height={400} className="h-40 w-full rounded-lg object-cover" unoptimized />
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">未上传图片</p>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">状态</p>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="启用">启用</option>
              <option value="草稿">草稿</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">排序（越小越靠前）</p>
            <input
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              inputMode="numeric"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">按钮文案</p>
            <input
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">按钮链接</p>
            <input
              value={ctaHref}
              onChange={(e) => setCtaHref(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              placeholder="/shop"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AdminShopBannerEditPage() {
  return (
    <Suspense fallback={null}>
      <AdminShopBannerEditPageContent />
    </Suspense>
  );
}
