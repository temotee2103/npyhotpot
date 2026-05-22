"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createOfficialMenuItemDraft,
  fetchOfficialMenuCategories,
  fetchOfficialMenuItemById,
  fetchOfficialMenuItemOptionGroupBindings,
  fetchOfficialMenuOptionGroups,
  updateOfficialMenuItem,
  type OfficialMenuCategory,
  type OfficialMenuItem,
  type OfficialMenuItemOptionGroupBinding,
  type OfficialMenuOptionGroup,
} from "@/lib/admin/official-delivery";
import { supabase } from "@/lib/supabase";
import { AdminFilePicker } from "@/components/admin-file-picker";

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

function DeliveryMenuItemEditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";
  const id = searchParams.get("id") || "";
  const isCreating = searchParams.get("new") === "1";

  const [item, setItem] = useState<OfficialMenuItem | null>(null);
  const [categories, setCategories] = useState<OfficialMenuCategory[] | null>(null);
  const [groups, setGroups] = useState<OfficialMenuOptionGroup[] | null>(null);

  const fallback = useMemo(
    () => ({
      id,
      name: id ? "未找到该商品" : "请选择商品",
      description: "",
      imageUrl: "",
      categoryId: null as string | null,
      basePrice: 0,
      status: "草稿" as const,
      tags: [] as string[],
      optionGroupIds: [] as string[],
    }),
    [id],
  );

  const source = item
    ? {
        id: item.id,
        name: item.name,
        description: item.description ?? "",
        imageUrl: item.image_url ?? "",
        categoryId: item.category_id,
        basePrice: Number(item.base_price),
        status: item.is_active ? ("上架" as const) : ("草稿" as const),
        tags: item.tags ?? [],
        optionGroupIds: [] as string[],
      }
    : fallback;

  const [name, setName] = useState(source.name);
  const [description, setDescription] = useState(source.description);
  const [imageUrl, setImageUrl] = useState(source.imageUrl);
  const [basePrice, setBasePrice] = useState(String(source.basePrice));
  const [status, setStatus] = useState<"上架" | "草稿">(source.status);
  const [categoryId, setCategoryId] = useState<string>(source.categoryId ?? "");
  const [tagsText, setTagsText] = useState(source.tags.join("，"));
  const [optionGroupIds, setOptionGroupIds] = useState<string[]>(fallback.optionGroupIds);
  const [saved, setSaved] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [optionGroupPriceOverrides, setOptionGroupPriceOverrides] = useState<OptionGroupPriceOverrideState>({});

  useEffect(() => {
    let active = true;
    Promise.all([fetchOfficialMenuCategories(), fetchOfficialMenuOptionGroups()]).then(([cats, ogs]) => {
      if (!active) return;
      setCategories(cats);
      setGroups(ogs);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([fetchOfficialMenuItemById(id), fetchOfficialMenuItemOptionGroupBindings(id)]).then(([it, bindings]) => {
        if (!active) return;
        if (it) {
          setItem(it);
          setName(it.name);
          setDescription(it.description ?? "");
          setImageUrl(it.image_url ?? "");
          setBasePrice(String(Number(it.base_price)));
          setStatus(it.is_active ? "上架" : "草稿");
          setCategoryId(it.category_id ?? "");
          setTagsText((it.tags ?? []).join("，"));
        }
        setOptionGroupIds(bindings.map((binding) => binding.group_id));
        setOptionGroupPriceOverrides(buildOptionGroupPriceOverrideState(bindings));
      },
    );
    return () => {
      active = false;
    };
  }, [id]);

  const selectedGroups = useMemo(() => {
    const map = new Map((groups ?? []).map((g) => [g.id, g]));
    return optionGroupIds.map((id) => map.get(id)).filter(Boolean) as OfficialMenuOptionGroup[];
  }, [groups, optionGroupIds]);

  const toggleGroupId = (groupId: string) => {
    setOptionGroupIds((prev) => {
      if (prev.includes(groupId)) return prev.filter((id) => id !== groupId);
      return [...prev, groupId];
    });
    setOptionGroupPriceOverrides((prev) => {
      if (!(groupId in prev)) return prev;
      const next = { ...prev };
      delete next[groupId];
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

  const categoryName = useMemo(() => {
    const map = new Map((categories ?? []).map((c) => [c.id, c.name]));
    return (id: string | null | undefined) => {
      if (!id) return "-";
      return map.get(id) ?? id;
    };
  }, [categories]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">A LA CARTE ITEM</p>
            <h1 className="mt-1 text-3xl font-black">{source.name}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              {categoryName(source.categoryId)} · {source.status} · ID {source.id}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/delivery/menu/items?channel=${channel}`}
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
                    setSaved("缺少商品ID");
                    return;
                  }
                  const draft = await createOfficialMenuItemDraft();
                  if (!draft) {
                    setSaving(false);
                    setSaved("创建失败，请重试");
                    return;
                  }
                  targetId = draft.id;
                }
                const result = await updateOfficialMenuItem({
                  id: targetId,
                  name,
                  description,
                  imageUrl,
                  categoryId,
                  basePrice,
                  tagsText,
                  isActive: status === "上架",
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
                if (!id && targetId) {
                  router.replace(`/admin/delivery/menu/items/edit?id=${targetId}&channel=${channel}`);
                }
                setSaved(`已保存：${new Date().toLocaleTimeString()}`);
              }}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
              type="button"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
        {saved && <p className="mt-3 text-xs font-bold text-primary">{saved}</p>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">基础信息</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">商品名称</p>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">商品描述</p>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-2 h-24 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">商品图片</p>
              <AdminFilePicker
                className="mt-2"
                disabled={!id}
                onSelect={async (files) => {
                  const file = files[0];
                  if (!file || !id || !supabase) return;
                  const ext = file.name.split(".").pop() || "jpg";
                  const path = `delivery/items/${id}/${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
                  if (error) {
                    setSaved(`上传失败：${error.message}`);
                    return;
                  }
                  const { data } = supabase.storage.from("media").getPublicUrl(path);
                  setImageUrl(data.publicUrl);
                  setSaved("图片上传成功，记得点击保存");
                }}
              />
              {!id ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">请先保存一次，再上传图片。</p> : null}
              {imageUrl ? (
                <div className="mt-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  <Image src={imageUrl} alt="单品图片" width={128} height={128} className="h-32 w-32 rounded-lg object-cover" unoptimized />
                </div>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">类目</p>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">请选择</option>
                {(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
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
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">标签（用中文逗号分隔）</p>
              <input
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
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
          <h2 className="text-xl font-black">规格组绑定</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">选择该商品可用的规格/加料组（必选/可选逻辑在组内定义）。</p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setGroupDropdownOpen((prev) => !prev)}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <span className="truncate text-slate-700 dark:text-slate-200">
                {selectedGroups.length === 0 ? "请选择规格组（可多选）" : selectedGroups.map((x) => x.name).join("、")}
              </span>
              <span className="material-symbols-outlined text-base text-slate-400">{groupDropdownOpen ? "expand_less" : "expand_more"}</span>
            </button>
            {groupDropdownOpen ? (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900/70">
                {(groups ?? []).map((group) => {
                  const checked = optionGroupIds.includes(group.id);
                  return (
                    <label
                      key={group.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm ${
                        checked ? "bg-primary/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGroupId(group.id)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span>
                        <span className="font-semibold">{group.name}</span>
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-300">
                          {group.required ? "必选" : "可选"} · {group.min_select}-{group.max_select}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}
            {groups && groups.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-300">暂无数据</p>}
            {groups === null && <p className="text-sm text-slate-500 dark:text-slate-300">加载中...</p>}
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
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
                <p className="text-sm font-bold">当前商品的规格项价格</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">这里填的是当前商品专属价格；不填差异时会沿用规格组默认加价。</p>
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
        </article>
      </section>
    </div>
  );
}

export default function DeliveryMenuItemEditPage() {
  return (
    <Suspense fallback={null}>
      <DeliveryMenuItemEditPageContent />
    </Suspense>
  );
}
