"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { BouncyActionButton } from "@/components/bouncy-action-button";
import { fetchOfficialSoupPackVariantById } from "@/lib/admin/official-shop";
import { getProductAeoContent } from "@/lib/aeo-content";
import { buildProductHeatingSteps } from "@/lib/geo-content";
import { countItems, getVariantQty, readCartState, setItem } from "@/lib/shop-cart";
import { useSuccessPulse } from "@/hooks/use-success-pulse";
import { assetPath } from "@/lib/site-config";

function mergeImages(primary: string | null | undefined, extra: string[] | undefined) {
  const out: string[] = [];
  const push = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    if (!s) return;
    if (!out.includes(s)) out.push(s);
  };
  push(primary ?? undefined);
  for (const v of extra ?? []) push(v);
  if (out.length === 0) out.push(assetPath("/logo.png"));
  return out;
}

export default function ShopDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const [currency, setCurrency] = useState<"MYR" | "SGD">("MYR");
  const [cartCount, setCartCount] = useState(0);
  const [loaded, setLoaded] = useState<null | Awaited<ReturnType<typeof fetchOfficialSoupPackVariantById>>>(null);
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [hoveringImage, setHoveringImage] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { trigger: triggerAddedPulse, isActive: isAddedPulsing } = useSuccessPulse(700);

  useEffect(() => {
    const onChange = () => setCartCount(countItems());
    onChange();
    window.addEventListener("shop:cart:change", onChange);
    return () => {
      window.removeEventListener("shop:cart:change", onChange);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchOfficialSoupPackVariantById(id).then((data) => {
      if (!active) return;
      setLoaded(data);
      const c = readCartState();
      const q = getVariantQty(c, id);
      if (q) setQty(q);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const name = loaded?.title ?? "商品不存在";
  const desc = loaded?.subtitle ?? "";
  const images = useMemo(() => mergeImages(loaded?.image_url ?? null, loaded?.images), [loaded?.image_url, loaded?.images]);
  const activeImageIndex = images.length > 0 ? imageIndex % images.length : 0;
  const price = useMemo(() => Number(loaded?.prices?.[currency] ?? 0), [currency, loaded]);
  const productAeoContent = useMemo(() => {
    if (!loaded) return null;
    return getProductAeoContent(loaded);
  }, [loaded]);
  const productFaqItems = productAeoContent?.faqItems ?? [];
  const aiAnswerItems = productAeoContent?.aiAnswerItems ?? [];
  const decisionCards = productAeoContent?.decisionCards ?? [];
  const heatingSteps = useMemo(() => buildProductHeatingSteps(loaded?.usage_text), [loaded?.usage_text]);

  useEffect(() => {
    if (!hoveringImage || images.length <= 1) return;
    const timer = window.setInterval(() => {
      setImageIndex((i) => (i + 1) % images.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [hoveringImage, images.length]);

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100 font-display">
      <Navbar cartCount={cartCount} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 py-4 md:px-4 md:py-8">
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-primary">
            首页
          </Link>
          <span>/</span>
          <Link href="/shop" className="hover:text-primary">
            商城
          </Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-slate-200">{name}</span>
        </nav>

        <Link href="/shop" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary">
          <span className="material-symbols-outlined text-base">chevron_left</span>
          返回商城
        </Link>

        <div className="mt-4 grid gap-5 md:mt-6 md:grid-cols-[1fr_1fr] md:gap-6">
          <div className="space-y-3">
            <div
              className="relative aspect-square overflow-hidden rounded-2xl border border-primary/10 bg-slate-100 dark:bg-white/5"
              onMouseEnter={() => setHoveringImage(true)}
              onMouseLeave={() => setHoveringImage(false)}
            >
              <Image src={images[activeImageIndex] ?? assetPath("/logo.png")} alt={name} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
            {images.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {images.map((src, idx) => (
                  <button
                    key={`${src}_${idx}`}
                    type="button"
                    onClick={() => setImageIndex(idx)}
                    className={`relative h-14 w-14 overflow-hidden rounded-lg border ${
                      idx === activeImageIndex ? "border-primary" : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <Image src={src} alt={`${name} 缩略图 ${idx + 1}`} fill sizes="56px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-black md:text-3xl">{name}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 md:text-base">{desc}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/shop" className="font-bold text-primary hover:text-primary/80">
                返回商城列表
              </Link>
              <Link href="/shop/bundles" className="font-bold text-primary hover:text-primary/80">
                查看 Bundle Set
              </Link>
              <Link href="/delivery" className="font-bold text-primary hover:text-primary/80">
                需要现煮外卖
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <span>币种:</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as typeof currency)}
                className="rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm dark:bg-slate-900"
              >
                <option value="MYR">MYR</option>
                <option value="SGD">SGD</option>
              </select>
            </div>

            <p className="text-3xl font-black text-primary">{currency === "SGD" ? "S$" : "RM"} {price.toFixed(2)}</p>

            <div className="rounded-3xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
              <p className="text-sm font-black">产品信息</p>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-300">SKU</span>
                  <span className="font-bold">{loaded?.sku ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-300">重量</span>
                  <span className="font-bold">{Number(loaded?.weight_kg ?? 0).toFixed(3)} kg</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-300">标签</span>
                  <span className="max-w-[70%] break-words text-right font-bold">
                    {(loaded?.tags ?? []).length ? (loaded?.tags ?? []).join("，") : "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="tap-bouncy h-11 w-11 rounded-2xl border border-primary/40 text-sm font-black text-primary hover:bg-primary/10"
              >
                -
              </button>
              <div className="w-10 text-center text-base font-bold">{qty}</div>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="tap-bouncy h-11 w-11 rounded-2xl border border-primary/40 text-sm font-black text-primary hover:bg-primary/10"
              >
                +
              </button>
            </div>

            <div className="hidden gap-3 md:flex">
              <BouncyActionButton
                onClick={() => {
                  if (!id) return;
                  setItem(id, qty);
                  setToast("已加入购物车");
                  triggerAddedPulse();
                  router.push("/shop?cart=1");
                }}
                success={isAddedPulsing()}
                icon={<span className="material-symbols-outlined text-base">add_shopping_cart</span>}
                successIcon={<span className="material-symbols-outlined text-base">done</span>}
                label="加入购物车"
                successLabel="已加入"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 active:scale-[0.98]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!id) return;
                  setItem(id, qty);
                  router.push("/shop?cart=1");
                }}
                className="tap-bouncy rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                去结算
              </button>
            </div>
          </div>
        </div>

        {toast ? (
          <div className="fixed right-4 top-[92px] z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg dark:bg-white dark:text-slate-900 md:right-5 md:top-auto md:bottom-5">
            {toast}
          </div>
        ) : null}

        <section className="mt-8 rounded-3xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mt-10 md:p-5">
          <h2 className="text-xl font-black">产品说明</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-sm font-black">食用方法</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {loaded?.usage_text?.trim()
                  ? loaded.usage_text
                  : "解冻后倒入锅中加热至沸腾，建议小火再煮 3–5 分钟；可搭配蔬菜、肉片、面条等一起食用。"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-sm font-black">保存方法</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {loaded?.storage_text?.trim()
                  ? loaded.storage_text
                  : "建议 -18°C 冷冻保存。开封后请尽快食用，若冷藏请于 24 小时内食用完毕。"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-sm font-black">温馨提示</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {loaded?.notice_text?.trim()
                  ? loaded.notice_text
                  : "图片仅供参考，实际以实物为准；如对食材过敏请先确认配料信息。"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mt-10 md:p-5">
          <p className="text-[11px] font-black tracking-[0.14em] text-primary">HOW TO HEAT</p>
          <h2 className="mt-2 text-xl font-black">加热步骤</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {heatingSteps.map((item, index) => (
              <article key={`${item.name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-black tracking-[0.12em] text-primary">STEP {index + 1}</p>
                <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{item.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mt-10 md:p-5">
          <p className="text-[11px] font-black tracking-[0.14em] text-primary">DECISION GUIDE</p>
          <h2 className="mt-2 text-xl font-black">购买判断答案块</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {decisionCards.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm font-black">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="geo-answer-ready mt-8 rounded-3xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mt-10 md:p-5">
          <p className="text-[11px] font-black tracking-[0.14em] text-primary">AI ANSWER READY</p>
          <h2 className="mt-2 text-xl font-black">可直接被 AI 引用的商品短答案</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {aiAnswerItems.map((item) => (
              <article key={item.question} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.question}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mt-10 md:p-5">
          <h2 className="text-xl font-black">常见问题</h2>
          <div className="mt-4 space-y-3">
            {productFaqItems.map((item, index) => (
              <details
                key={item.question}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                open={index === 0}
              >
                <summary className="cursor-pointer text-sm font-black text-slate-900 dark:text-slate-100">
                  {item.question}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <div className="mobile-sticky-action-bar md:hidden">
        <div className="mobile-sticky-action-bar__inner">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-[color:var(--foreground)]">{name}</p>
            <p className="text-xs text-[color:var(--theme-muted)]">
              {currency === "SGD" ? "S$" : "RM"} {price.toFixed(2)} · 数量 {qty}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!id) return;
              setItem(id, qty);
              setToast("已加入购物车");
              triggerAddedPulse();
            }}
            className="tap-bouncy rounded-2xl border border-primary/30 px-4 py-3 text-sm font-black text-primary"
          >
            加购
          </button>
          <button
            type="button"
            onClick={() => {
              if (!id) return;
              setItem(id, qty);
              router.push("/shop?cart=1");
            }}
            className="tap-bouncy rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white shadow-lg shadow-primary/25"
          >
            去结算
          </button>
        </div>
      </div>

      <Footer />
      <div aria-hidden className="mobile-page-bottom-space md:hidden" />
    </div>
  );
}
