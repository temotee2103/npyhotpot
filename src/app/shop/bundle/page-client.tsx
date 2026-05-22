"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { BouncyActionButton } from "@/components/bouncy-action-button";
import { getBundleAeoContent } from "@/lib/aeo-content";
import {
  fetchOfficialBundleById,
  fetchOfficialBundleItems,
  fetchOfficialSoupPackVariants,
  type OfficialBundleItem,
  type OfficialSoupPackVariant,
} from "@/lib/admin/official-shop";
import { addBundleToCart, countItems } from "@/lib/shop-cart";
import { useSuccessPulse } from "@/hooks/use-success-pulse";
import { assetPath } from "@/lib/site-config";

function clampInt(v: string, fallback = 0) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export default function ShopBundleDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const [currency, setCurrency] = useState<"MYR" | "SGD">("MYR");
  const [cartCount, setCartCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<null | Awaited<ReturnType<typeof fetchOfficialBundleById>>>(null);
  const [items, setItems] = useState<OfficialBundleItem[] | null>(null);
  const [variants, setVariants] = useState<OfficialSoupPackVariant[] | null>(null);
  const [bundleQty, setBundleQty] = useState("1");
  const [qtyByVariantId, setQtyByVariantId] = useState<Record<string, number>>({});
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
    Promise.all([fetchOfficialBundleById(id), fetchOfficialBundleItems(id), fetchOfficialSoupPackVariants()]).then(([b, i, v]) => {
      if (!active) return;
      setLoaded(b);
      setItems(i);
      setVariants(v.filter((x) => x.status === "active"));
    });
    return () => {
      active = false;
    };
  }, [id]);

  const bundleTitle = loaded?.title ?? "Bundle 不存在";
  const allowedVariantIds = useMemo(() => new Set((items ?? []).map((x) => x.variant_id)), [items]);
  const allowedVariants = useMemo(() => (variants ?? []).filter((v) => allowedVariantIds.has(v.id)), [allowedVariantIds, variants]);

  const setCount = Math.max(1, clampInt(bundleQty, 1));
  const buy = Math.max(0, loaded?.buy_qty ?? 0);
  const free = Math.max(0, loaded?.free_qty ?? 0);
  const perSetCount = loaded?.rule_kind === "buy_x_get_y" ? buy + free : 0;
  const requiredCount = loaded?.rule_kind === "buy_x_get_y" ? perSetCount * setCount : 0;

  const selectedCount = useMemo(() => {
    return Object.values(qtyByVariantId).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
  }, [qtyByVariantId]);

  const remaining = Math.max(0, requiredCount - selectedCount);

  const fixedBundleItems = useMemo(() => {
    if (!loaded || loaded.rule_kind !== "fixed_bundle") return [];
    const map = new Map((variants ?? []).map((v) => [v.id, v]));
    return (items ?? [])
      .map((it) => {
        const v = map.get(it.variant_id) ?? null;
        return v ? { variant: v, qty: it.quantity } : null;
      })
      .filter(Boolean) as Array<{ variant: OfficialSoupPackVariant; qty: number }>;
  }, [items, loaded, variants]);

  const pricePreview = useMemo(() => {
    if (!loaded) return 0;
    if (loaded.pricing_mode === "manual") {
      const p = currency === "SGD" ? Number(loaded.sgd_price ?? 0) : Number(loaded.myr_price ?? 0);
      return p * setCount;
    }
    if (loaded.rule_kind === "fixed_bundle") {
      return fixedBundleItems.reduce((sum, row) => sum + Number(row.variant.prices[currency] ?? 0) * row.qty, 0) * setCount;
    }
    const chosen = allowedVariants.filter((v) => (qtyByVariantId[v.id] ?? 0) > 0);
    const maxPrice = chosen.reduce((m, v) => Math.max(m, Number(v.prices[currency] ?? 0)), 0);
    return maxPrice * buy * setCount;
  }, [allowedVariants, buy, currency, fixedBundleItems, loaded, qtyByVariantId, setCount]);

  const weightPreview = useMemo(() => {
    if (!loaded) return 0;
    if (loaded.rule_kind === "fixed_bundle") {
      return fixedBundleItems.reduce((sum, row) => sum + Number(row.variant.weight_kg ?? 0) * row.qty, 0) * setCount;
    }
    const chosen = allowedVariants.filter((v) => (qtyByVariantId[v.id] ?? 0) > 0);
    const maxWeight = chosen.reduce((m, v) => Math.max(m, Number(v.weight_kg ?? 0)), 0);
    return maxWeight * requiredCount;
  }, [allowedVariants, fixedBundleItems, loaded, qtyByVariantId, requiredCount, setCount]);

  const canAdd =
    loaded?.rule_kind === "fixed_bundle" ? setCount > 0 : requiredCount > 0 && selectedCount === requiredCount && allowedVariants.some((v) => (qtyByVariantId[v.id] ?? 0) > 0);
  const bundleAeoContent = useMemo(() => {
    if (!loaded) return null;
    return getBundleAeoContent(loaded);
  }, [loaded]);
  const bundleFaqItems = bundleAeoContent?.faqItems ?? [];
  const aiAnswerItems = bundleAeoContent?.aiAnswerItems ?? [];
  const decisionCards = bundleAeoContent?.decisionCards ?? [];

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
          <Link href="/shop/bundles" className="hover:text-primary">
            Bundle Set
          </Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-slate-200">{bundleTitle}</span>
        </nav>

        <Link href="/shop/bundles" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary">
          <span className="material-symbols-outlined text-base">chevron_left</span>
          返回 Bundle
        </Link>

        <div className="mt-4 grid gap-5 md:mt-6 md:grid-cols-[1fr_1fr] md:gap-6">
          <div className="relative aspect-[16/12] overflow-hidden rounded-3xl border border-primary/10 bg-slate-100 dark:bg-white/5">
            <Image src={loaded?.image_url ?? assetPath("/logo.png")} alt={bundleTitle} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>

          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-black">{bundleTitle}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              {loaded?.rule_kind === "buy_x_get_y" ? `买 ${buy} 送 ${free}` : "自选组合（客制化）"}
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/shop/bundles" className="font-bold text-primary hover:text-primary/80">
                返回 Bundle 列表
              </Link>
              <Link href="/shop" className="font-bold text-primary hover:text-primary/80">
                浏览商城单品
              </Link>
              <Link href="/delivery" className="font-bold text-primary hover:text-primary/80">
                改看火锅外卖
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

            <div className="flex items-center gap-3">
              <span>数量:</span>
              <input
                value={bundleQty}
                onChange={(e) => setBundleQty(e.target.value)}
                className="w-20 rounded-2xl border border-primary/20 bg-white px-3 py-2.5 text-sm dark:bg-slate-900"
                inputMode="numeric"
              />
            </div>

            <div className="rounded-3xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
              <div className="flex items-center justify-between text-sm">
                <p className="text-slate-500 dark:text-slate-300">预估总重</p>
                <p className="font-black">{Number(weightPreview).toFixed(3)} kg</p>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <p className="text-slate-500 dark:text-slate-300">预估金额</p>
                <p className="font-black text-primary">{currency === "SGD" ? "S$" : "RM"} {Number(pricePreview).toFixed(2)}</p>
              </div>
              {loaded?.rule_kind === "buy_x_get_y" && (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <p className="text-slate-500 dark:text-slate-300">待分配数量</p>
                  <p className="font-black">{remaining}</p>
                </div>
              )}
            </div>

            <div className="hidden md:block">
              <BouncyActionButton
                disabled={!canAdd}
                onClick={() => {
                  if (!loaded) return;
                  if (loaded.rule_kind === "fixed_bundle") {
                    const selection = Object.fromEntries(fixedBundleItems.map((row) => [row.variant.id, row.qty * setCount]));
                    addBundleToCart({ bundleId: loaded.id, qty: setCount, selection });
                    setToast("已加入购物车");
                    triggerAddedPulse();
                    return;
                  }
                  const selection = Object.fromEntries(
                    Object.entries(qtyByVariantId)
                      .map(([k, v]) => [k, Number(v ?? 0)] as const)
                      .filter(([, v]) => v > 0),
                  );
                  addBundleToCart({ bundleId: loaded.id, qty: setCount, selection });
                  setToast("已加入购物车");
                  triggerAddedPulse();
                }}
                success={isAddedPulsing()}
                icon={<span className="material-symbols-outlined text-base text-[color:var(--warm-neutral-50)]">add_shopping_cart</span>}
                successIcon={<span className="material-symbols-outlined text-base text-[color:var(--warm-neutral-50)]">done</span>}
                label="加入购物车"
                successLabel="已加入"
                contentClassName="text-[color:var(--warm-neutral-50)]"
                className="bundle-add-cart-button w-full rounded-xl bg-primary px-4 py-3 text-sm font-black text-[color:var(--warm-neutral-50)] hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/75 disabled:opacity-100"
              />
            </div>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mt-10 md:p-5">
          <h2 className="text-xl font-black">选择内容</h2>
          {loaded?.rule_kind === "fixed_bundle" ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {fixedBundleItems.map((row) => (
                <div key={row.variant.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="font-bold">{row.variant.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">× {row.qty}</p>
                </div>
              ))}
              {fixedBundleItems.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-300">暂无配置</p>}
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {allowedVariants.map((v) => {
                const q = qtyByVariantId[v.id] ?? 0;
                const canInc = selectedCount < requiredCount;
                return (
                  <div key={v.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold truncate" title={v.title}>
                          {v.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                          {currency === "SGD" ? "S$" : "RM"} {Number(v.prices[currency] ?? 0).toFixed(2)} · {Number(v.weight_kg ?? 0).toFixed(3)} kg
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQtyByVariantId((prev) => ({ ...prev, [v.id]: Math.max(0, (prev[v.id] ?? 0) - 1) }))}
                          className="tap-bouncy h-8 w-8 rounded-md border border-primary/40 text-sm font-black text-primary hover:bg-primary/10"
                          disabled={q <= 0}
                        >
                          -
                        </button>
                        <div className="w-8 text-center text-sm font-bold">{q}</div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canInc) return;
                            setQtyByVariantId((prev) => ({ ...prev, [v.id]: (prev[v.id] ?? 0) + 1 }));
                          }}
                          className="tap-bouncy h-8 w-8 rounded-md border border-primary/40 text-sm font-black text-primary hover:bg-primary/10 disabled:opacity-60"
                          disabled={!canInc}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {allowedVariants.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-300">暂无可选商品</p>}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mt-10 md:p-5">
          <p className="text-[11px] font-black tracking-[0.14em] text-primary">DECISION GUIDE</p>
          <h2 className="mt-2 text-xl font-black">套餐购买判断答案块</h2>
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
          <h2 className="mt-2 text-xl font-black">可直接被 AI 引用的套餐短答案</h2>
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
            {bundleFaqItems.map((item, index) => (
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

      {toast ? (
        <div className="fixed right-4 top-[92px] z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg dark:bg-white dark:text-slate-900 md:right-5 md:top-auto md:bottom-5">
          {toast}
        </div>
      ) : null}

      <div className="mobile-sticky-action-bar md:hidden">
        <div className="mobile-sticky-action-bar__inner">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-[color:var(--foreground)]">{bundleTitle}</p>
            <p className="text-xs text-[color:var(--theme-muted)]">
              {currency === "SGD" ? "S$" : "RM"} {Number(pricePreview).toFixed(2)} · 待分配 {remaining}
            </p>
          </div>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => {
              if (!loaded) return;
              if (loaded.rule_kind === "fixed_bundle") {
                const selection = Object.fromEntries(fixedBundleItems.map((row) => [row.variant.id, row.qty * setCount]));
                addBundleToCart({ bundleId: loaded.id, qty: setCount, selection });
                setToast("已加入购物车");
                triggerAddedPulse();
                return;
              }
              const selection = Object.fromEntries(
                Object.entries(qtyByVariantId)
                  .map(([k, v]) => [k, Number(v ?? 0)] as const)
                  .filter(([, v]) => v > 0),
              );
              addBundleToCart({ bundleId: loaded.id, qty: setCount, selection });
              setToast("已加入购物车");
              triggerAddedPulse();
            }}
            className="tap-bouncy rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white shadow-lg shadow-primary/25 disabled:opacity-60"
          >
            加入购物车
          </button>
        </div>
      </div>

      <Footer />
      <div aria-hidden className="mobile-page-bottom-space md:hidden" />
    </div>
  );
}
