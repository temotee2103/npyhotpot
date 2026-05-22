"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createOfficialMenuComboDraft,
  fetchOfficialMenuComboComponentIds,
  fetchOfficialMenuItemById,
  fetchOfficialMenuItemOptionGroupBindings,
  fetchOfficialMenuItems,
  fetchOfficialMenuOptionGroups,
  updateOfficialMenuCombo,
  type OfficialMenuItem,
  type OfficialMenuItemOptionGroupBinding,
  type OfficialMenuOptionGroup,
} from "@/lib/admin/official-delivery";

type OptionGroupPriceOverrideState = Record<string, Record<string, string>>;

function buildOptionGroupPriceOverrideState(bindings: OfficialMenuItemOptionGroupBinding[]): OptionGroupPriceOverrideState {
  return bindings.reduce<OptionGroupPriceOverrideState>((acc, binding) => {
    acc[binding.group_id] = Object.entries(binding.option_price_overrides).reduce<Record<string, string>>((groupAcc, [optionId, priceDelta]) => {
      groupAcc[optionId] = String(priceDelta);
      return groupAcc;
    }, {});
    return acc;
  }, {});
}

function parseOptionPriceInput(raw: string, fallback: number) {
  const value = raw.trim();
  if (!value) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Number(number.toFixed(2));
}

function DeliveryMenuComboEditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";
  const id = searchParams.get("id") || "";
  const isCreating = searchParams.get("new") === "1";

  const [combo, setCombo] = useState<OfficialMenuItem | null>(null);
  const [availableComponents, setAvailableComponents] = useState<OfficialMenuItem[] | null>(null);
  const [availableGroups, setAvailableGroups] = useState<OfficialMenuOptionGroup[] | null>(null);

  const fallback = useMemo(
    () => ({
      id,
      name: id ? "未找到该套餐" : "请选择套餐",
      basePrice: 0,
      status: "草稿" as const,
    }),
    [id],
  );

  const [name, setName] = useState(fallback.name);
  const [basePrice, setBasePrice] = useState(String(fallback.basePrice));
  const [status, setStatus] = useState<"上架" | "草稿">(fallback.status);
  const [componentIds, setComponentIds] = useState<string[]>([]);
  const [optionGroupIds, setOptionGroupIds] = useState<string[]>([]);
  const [saved, setSaved] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);
  const [optionGroupPriceOverrides, setOptionGroupPriceOverrides] = useState<OptionGroupPriceOverrideState>({});

  useEffect(() => {
    let active = true;
    Promise.all([fetchOfficialMenuItems("ala_carte"), fetchOfficialMenuOptionGroups()]).then(([components, groups]) => {
      if (!active) return;
      setAvailableComponents(components);
      setAvailableGroups(groups);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([fetchOfficialMenuItemById(id), fetchOfficialMenuComboComponentIds(id), fetchOfficialMenuItemOptionGroupBindings(id)]).then(
      ([c, componentIds, bindings]) => {
        if (!active) return;
        if (c) {
          setCombo(c);
          setName(c.name);
          setBasePrice(String(Number(c.base_price)));
          setStatus(c.is_active ? "上架" : "草稿");
        }
        setComponentIds(componentIds);
        setOptionGroupIds(bindings.map((binding) => binding.group_id));
        setOptionGroupPriceOverrides(buildOptionGroupPriceOverrideState(bindings));
      },
    );
    return () => {
      active = false;
    };
  }, [id]);

  const toggleGroup = (id: string) => {
    setOptionGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
    setOptionGroupPriceOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setOptionPriceOverride = (groupId: string, optionId: string, value: string) => {
    setOptionGroupPriceOverrides((prev) => ({
      ...prev,
      [groupId]: {
        ...(prev[groupId] ?? {}),
        [optionId]: value,
      },
    }));
  };

  const toggleComponent = (id: string) => {
    setComponentIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const selectedGroups = useMemo(() => {
    const map = new Map((availableGroups ?? []).map((g) => [g.id, g]));
    return optionGroupIds.map((id) => map.get(id)).filter(Boolean) as OfficialMenuOptionGroup[];
  }, [availableGroups, optionGroupIds]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">COMBO BUILDER</p>
            <h1 className="mt-1 text-3xl font-black">{combo?.name ?? fallback.name}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">套餐结构、加购与选项组统一在此配置。</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/delivery/menu/combos?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
            >
              返回列表
            </Link>
            <button
              onClick={async () => {
                if (saving) return;
                setSaving(true);
                setSaved(null);
                let targetId = id;
                if (!targetId) {
                  if (!isCreating) {
                    setSaving(false);
                    setSaved("缺少套餐ID");
                    return;
                  }
                  const draft = await createOfficialMenuComboDraft();
                  if (!draft) {
                    setSaving(false);
                    setSaved("创建失败，请重试");
                    return;
                  }
                  targetId = draft.id;
                }
                const result = await updateOfficialMenuCombo({
                  id: targetId,
                  name,
                  basePrice,
                  isActive: status === "上架",
                  componentIds,
                  optionGroupBindings: selectedGroups.map((group) => ({
                    groupId: group.id,
                    optionPriceOverrides: (group.official_menu_option_options ?? [])
                      .map((option) => {
                        const rawPrice = optionGroupPriceOverrides[group.id]?.[option.id];
                        const nextPrice = parseOptionPriceInput(rawPrice ?? String(option.price_delta ?? 0), Number(option.price_delta ?? 0));
                        return {
                          optionId: option.id,
                          priceDelta: nextPrice,
                          defaultPriceDelta: Number(option.price_delta ?? 0),
                        };
                      })
                      .filter((option) => option.priceDelta !== option.defaultPriceDelta)
                      .map(({ optionId, priceDelta }) => ({ optionId, priceDelta })),
                  })),
                });
                setSaving(false);
                if (!result.ok) {
                  setSaved(`保存失败：${result.message}`);
                  return;
                }
                router.push(`/admin/delivery/menu/combos?channel=${channel}`);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              type="button"
              disabled={saving}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
        {saved && <p className="mt-3 text-xs font-bold text-primary">{saved}</p>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">基础信息</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">套餐名称</p>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">基础价 (RM)</p>
              <input
                value={basePrice}
                onChange={(event) => setBasePrice(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                inputMode="decimal"
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
                <option value="草稿">草稿</option>
              </select>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">套餐组件（从单品库选择）</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">用于明确套餐包含哪些基础商品，可与出餐拆解逻辑对齐。</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(availableComponents ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleComponent(item.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  componentIds.includes(item.id)
                    ? "border-primary bg-primary/10"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60"
                }`}
              >
                <p className="font-bold">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">RM {Number(item.base_price).toFixed(2)}</p>
              </button>
            ))}
            {availableComponents && availableComponents.length === 0 && <div className="text-sm text-slate-500 dark:text-slate-300">暂无数据</div>}
            {availableComponents === null && <div className="text-sm text-slate-500 dark:text-slate-300">加载中...</div>}
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-sm font-bold">已选组件</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {componentIds.length === 0 ? (
                <span className="text-sm text-slate-500 dark:text-slate-300">暂无</span>
              ) : (
                componentIds.map((id) => (
                  <span key={id} className="rounded-full bg-white px-2 py-1 text-xs font-semibold dark:bg-slate-700">
                    {(availableComponents ?? []).find((item) => item.id === id)?.name ?? id}
                  </span>
                ))
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h2 className="text-xl font-black">规格组（必选 / 可选加购）</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">套餐也可以绑定规格组：比如主锅选择（必选）、加价蛋白（可选）。</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {(availableGroups ?? []).map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => toggleGroup(group.id)}
              className={`rounded-xl border p-3 text-left transition ${
                optionGroupIds.includes(group.id)
                  ? "border-primary bg-primary/10"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold">{group.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  {group.required ? "必选" : "可选"} · {group.min_select}-{group.max_select}
                </p>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                {(group.official_menu_option_options ?? [])
                  .slice(0, 4)
                  .map((opt) => `${opt.name}${opt.price_delta ? ` +RM${opt.price_delta}` : ""}`)
                  .join("、")}
                {(group.official_menu_option_options ?? []).length > 4 ? "…" : ""}
              </p>
            </button>
          ))}
          {availableGroups && availableGroups.length === 0 && <div className="text-sm text-slate-500 dark:text-slate-300">暂无数据</div>}
          {availableGroups === null && <div className="text-sm text-slate-500 dark:text-slate-300">加载中...</div>}
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-sm font-bold">已绑定</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedGroups.length === 0 ? (
              <span className="text-sm text-slate-500 dark:text-slate-300">暂无</span>
            ) : (
              selectedGroups.map((group) => (
                <span key={group.id} className="rounded-full bg-white px-2 py-1 text-xs font-semibold dark:bg-slate-700">
                  {group.name}
                </span>
              ))
            )}
          </div>
        </div>
        {selectedGroups.length > 0 ? (
          <div className="mt-5 space-y-3">
            <div>
              <p className="text-sm font-bold">当前套餐的规格项价格</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">同一个规格组绑定到不同套餐时，可以在这里单独覆盖每个规格项加价。</p>
            </div>
            {selectedGroups.map((group) => (
              <div key={group.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{group.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    {group.required ? "必选" : "可选"} · {group.min_select}-{group.max_select}
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {(group.official_menu_option_options ?? []).map((option) => (
                    <div key={option.id} className="grid grid-cols-[1fr_140px] items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold">{option.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-300">默认加价 RM {Number(option.price_delta ?? 0).toFixed(2)}</p>
                      </div>
                      <input
                        value={optionGroupPriceOverrides[group.id]?.[option.id] ?? String(Number(option.price_delta ?? 0))}
                        onChange={(event) => setOptionPriceOverride(group.id, option.id, event.target.value)}
                        inputMode="decimal"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function DeliveryMenuComboEditPage() {
  return (
    <Suspense fallback={null}>
      <DeliveryMenuComboEditPageContent />
    </Suspense>
  );
}
