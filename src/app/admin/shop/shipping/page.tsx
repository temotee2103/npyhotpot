"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  fetchOfficialShopShippingRates,
  upsertOfficialShopShippingRate,
  type OfficialShopShippingRate,
} from "@/lib/admin/official-shop";

function AdminShopShippingPageContent() {
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "shop";

  const [rows, setRows] = useState<OfficialShopShippingRate[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const [myFee, setMyFee] = useState("0");
  const [myActive, setMyActive] = useState(true);
  const [sgFee, setSgFee] = useState("0");
  const [sgActive, setSgActive] = useState(true);

  useEffect(() => {
    let active = true;
    fetchOfficialShopShippingRates().then((data) => {
      if (!active) return;
      setRows(data);
      const map = new Map(data.map((row) => [`${row.currency}_${row.country}`, row]));
      const my = map.get("MYR_MY");
      const sg = map.get("SGD_SG");
      setMyFee(my ? String(my.fee ?? 0) : "0");
      setMyActive(my ? Boolean(my.is_active) : true);
      setSgFee(sg ? String(sg.fee ?? 0) : "0");
      setSgActive(sg ? Boolean(sg.is_active) : true);
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
            <p className="text-xs font-bold tracking-[0.14em] text-primary">SHOP</p>
            <h1 className="mt-1 text-3xl font-black">运费设定</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">用于 /shop 购物车结算：按币种 + 收件邮编国家计算运费</p>
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
              disabled={saving || !rows}
              onClick={async () => {
                if (!rows || saving) return;
                setSaving(true);
                setSaved(null);
                const r1 = await upsertOfficialShopShippingRate({ currency: "MYR", country: "MY", fee: myFee, isActive: myActive });
                const r2 = await upsertOfficialShopShippingRate({ currency: "SGD", country: "SG", fee: sgFee, isActive: sgActive });
                setSaving(false);
                if (!r1.ok) return setSaved(`保存失败：${r1.message}`);
                if (!r2.ok) return setSaved(`保存失败：${r2.message}`);
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

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">MYR + 马来西亚 (MY)</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">邮编规则：5 位数字（例：50000）</p>
          <div className="mt-4 grid gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">配送费 (MYR)</p>
              <input
                value={myFee}
                onChange={(e) => setMyFee(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                inputMode="decimal"
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={myActive} onChange={(e) => setMyActive(e.target.checked)} className="h-4 w-4 accent-primary" />
              启用该运费
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">SGD + 新加坡 (SG)</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">邮编规则：6 位数字（例：018989）</p>
          <div className="mt-4 grid gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">配送费 (SGD)</p>
              <input
                value={sgFee}
                onChange={(e) => setSgFee(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                inputMode="decimal"
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={sgActive} onChange={(e) => setSgActive(e.target.checked)} className="h-4 w-4 accent-primary" />
              启用该运费
            </label>
          </div>
        </article>
      </section>
    </div>
  );
}

export default function AdminShopShippingPage() {
  return (
    <Suspense fallback={null}>
      <AdminShopShippingPageContent />
    </Suspense>
  );
}
