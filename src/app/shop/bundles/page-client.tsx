"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { fetchOfficialBundles, type OfficialBundle } from "@/lib/admin/official-shop";
import { countItems } from "@/lib/shop-cart";
import { assetPath } from "@/lib/site-config";

export default function ShopBundlesPage() {
  const [cartCount, setCartCount] = useState(0);
  const [bundles, setBundles] = useState<OfficialBundle[] | null>(null);

  useEffect(() => {
    const onChange = () => setCartCount(countItems());
    onChange();
    window.addEventListener("shop:cart:change", onChange);
    return () => {
      window.removeEventListener("shop:cart:change", onChange);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchOfficialBundles().then((rows) => {
      if (!active) return;
      setBundles(rows.filter((b) => b.status === "active"));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100 font-display">
      <Navbar cartCount={cartCount} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Bundle Set</h1>
          <Link href="/shop" className="text-sm font-bold text-primary hover:text-primary/80">
            返回商城
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {(bundles ?? []).map((b) => (
            <Link
              key={b.id}
              href={`/shop/bundle?id=${b.id}`}
              className="group rounded-2xl overflow-hidden border border-primary/10 bg-white shadow-sm hover:shadow-xl transition-all dark:bg-white/5"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-white/5">
                <Image
                  src={b.image_url ?? assetPath("/logo.png")}
                  alt={b.title}
                  fill
                  className="object-contain p-6 transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute left-3 top-3 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Bundle</div>
              </div>
              <div className="p-4">
                <p className="font-black line-clamp-2">{b.title}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  {b.rule_kind === "buy_x_get_y" ? `买 ${b.buy_qty ?? 0} 送 ${b.free_qty ?? 0}` : "自选组合（客制化）"}
                </p>
              </div>
            </Link>
          ))}
          {bundles && bundles.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-300">暂无 Bundle</p>}
          {bundles === null && <p className="text-sm text-slate-500 dark:text-slate-300">加载中...</p>}
        </div>
      </main>

      <Footer />
    </div>
  );
}
