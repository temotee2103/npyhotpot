import { supabase } from "@/lib/supabase";

export type OfficialMenuCategory = {
  id: string;
  name: string;
  sort: number;
  availability: string;
  is_active: boolean;
};

export type OfficialMenuOption = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  sort: number;
};

export type OfficialMenuItemOptionPriceOverride = {
  item_id: string;
  group_id: string;
  option_id: string;
  price_delta: number;
};

export type OfficialMenuOptionGroup = {
  id: string;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number;
  is_active: boolean;
  official_menu_option_options: OfficialMenuOption[] | null;
};

export type OfficialMenuItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  item_type: "ala_carte" | "combo";
  base_price: number;
  sort: number;
  tags: string[] | null;
  is_active: boolean;
  created_at: string | null;
  official_menu_categories?: { name: string } | null;
};

export type OfficialMenuItemWithOptionGroups = OfficialMenuItem & {
  option_group_ids: string[];
  option_groups: OfficialMenuOptionGroup[];
};

export type OfficialMenuItemOptionGroupBinding = {
  item_id: string;
  group_id: string;
  option_price_overrides: Record<string, number>;
};

const MENU_ITEM_BASE_SELECT =
  "id,name,description,category_id,item_type,base_price,sort,tags,is_active,created_at,official_menu_categories(name)";
const MENU_ITEM_SELECT_WITH_IMAGE =
  "id,name,description,image_url,category_id,item_type,base_price,sort,tags,is_active,created_at,official_menu_categories(name)";
const OPTION_GROUP_WITH_OPTIONS_SELECT =
  "id,name,required,min_select,max_select,is_active,official_menu_option_options!official_menu_option_options_group_id_fkey(id,group_id,name,price_delta,sort)";

function isMissingImageUrlColumnError(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return message.includes("image_url") && (message.includes("column") || message.includes("schema cache"));
}

function isMissingOptionPriceOverrideTableError(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return (
    message.includes("official_menu_item_option_price_overrides") &&
    (message.includes("does not exist") || message.includes("schema cache") || message.includes("relation"))
  );
}

function withDefaultImage(row: Omit<OfficialMenuItem, "image_url"> & { image_url?: string | null }): OfficialMenuItem {
  return {
    ...row,
    image_url: row.image_url ?? null,
  };
}

function normalizeMoneyNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(2));
}

function withSortedOptionGroups(groups: OfficialMenuOptionGroup[]): OfficialMenuOptionGroup[] {
  return groups.map((group) => ({
    ...group,
    official_menu_option_options: [...(group.official_menu_option_options ?? [])].sort((a, b) => a.sort - b.sort),
  }));
}

function compareNullableDateDesc(a: string | null | undefined, b: string | null | undefined) {
  const aTime = a ? Date.parse(a) : Number.NaN;
  const bTime = b ? Date.parse(b) : Number.NaN;
  const safeA = Number.isFinite(aTime) ? aTime : -Infinity;
  const safeB = Number.isFinite(bTime) ? bTime : -Infinity;
  return safeB - safeA;
}

async function fetchNextOfficialMenuItemSort(itemType: "ala_carte" | "combo"): Promise<number> {
  if (!supabase) return 1;
  const { data, error } = await supabase
    .from("official_menu_items")
    .select("sort")
    .eq("item_type", itemType)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return 1;
  return Math.max(Number((data as { sort?: number | null } | null)?.sort ?? 0), 0) + 1;
}

export function sortOfficialMenuItemsByCategoryOrder<T extends Pick<OfficialMenuItem, "category_id" | "sort" | "created_at" | "id">>(
  items: T[],
  categories: OfficialMenuCategory[],
): T[] {
  const categorySortMap = new Map(categories.map((category, index) => [category.id, { sort: category.sort, index }]));
  return [...items].sort((a, b) => {
    const aCategory = a.category_id ? categorySortMap.get(a.category_id) : null;
    const bCategory = b.category_id ? categorySortMap.get(b.category_id) : null;
    const aCategorySort = aCategory?.sort ?? Number.MAX_SAFE_INTEGER;
    const bCategorySort = bCategory?.sort ?? Number.MAX_SAFE_INTEGER;
    if (aCategorySort !== bCategorySort) return aCategorySort - bCategorySort;

    const aCategoryIndex = aCategory?.index ?? Number.MAX_SAFE_INTEGER;
    const bCategoryIndex = bCategory?.index ?? Number.MAX_SAFE_INTEGER;
    if (aCategoryIndex !== bCategoryIndex) return aCategoryIndex - bCategoryIndex;

    if (a.sort !== b.sort) return a.sort - b.sort;

    const createdAtDiff = compareNullableDateDesc(a.created_at, b.created_at);
    if (createdAtDiff !== 0) return createdAtDiff;

    return a.id.localeCompare(b.id);
  });
}

export async function fetchOfficialMenuCategories(): Promise<OfficialMenuCategory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_menu_categories")
    .select("id,name,sort,availability,is_active")
    .order("sort", { ascending: true });
  if (error || !data) return [];
  return (data as unknown) as OfficialMenuCategory[];
}

function parseIntNumber(raw: string, fallback = 0): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function isValidTime24(raw: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw);
}

function normalizeAvailability(raw: string): string | null {
  const text = raw.trim();
  const match = text.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)\s*-\s*([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (!match) return null;
  const startHour = String(Number.parseInt(match[1], 10)).padStart(2, "0");
  const startMin = match[2];
  const endHour = String(Number.parseInt(match[3], 10)).padStart(2, "0");
  const endMin = match[4];
  const start = `${startHour}:${startMin}`;
  const end = `${endHour}:${endMin}`;
  if (!isValidTime24(start) || !isValidTime24(end)) return null;
  return `${start} - ${end}`;
}

export async function createOfficialMenuCategoryDraft(): Promise<OfficialMenuCategory | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("official_menu_categories")
    .insert({
      name: "新类目",
      sort: 0,
      availability: "11:00 - 00:00",
      is_active: false,
    })
    .select("id,name,sort,availability,is_active")
    .single();
  if (error || !data) return null;
  return (data as unknown) as OfficialMenuCategory;
}

export async function fetchOfficialMenuCategoryById(id: string): Promise<OfficialMenuCategory | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("official_menu_categories")
    .select("id,name,sort,availability,is_active")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as unknown) as OfficialMenuCategory;
}

export async function updateOfficialMenuCategory(args: {
  id: string;
  name: string;
  sort: string;
  availability: string;
  isActive: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const availability = normalizeAvailability(args.availability);
  if (!availability) return { ok: false, message: "营业时段格式必须为 HH:mm - HH:mm（24小时制）" };
  const payload = {
    name: args.name.trim() || "未命名类目",
    sort: Math.max(0, parseIntNumber(args.sort, 0)),
    availability,
    is_active: args.isActive,
  };
  const { error } = await supabase.from("official_menu_categories").update(payload).eq("id", args.id);
  if (error) return { ok: false, message: error.message || "保存失败" };
  return { ok: true };
}

export async function deleteOfficialMenuCategory(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { error } = await supabase.from("official_menu_categories").delete().eq("id", id);
  if (error) return { ok: false, message: error.message || "删除失败" };
  return { ok: true };
}

export async function reorderOfficialMenuCategories(idsInOrder: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  for (let i = 0; i < idsInOrder.length; i += 1) {
    const { error } = await supabase
      .from("official_menu_categories")
      .update({ sort: i + 1 })
      .eq("id", idsInOrder[i]);
    if (error) return { ok: false, message: error.message || "排序保存失败" };
  }
  return { ok: true };
}

export async function fetchOfficialMenuOptionGroups(): Promise<OfficialMenuOptionGroup[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_menu_option_groups")
    .select(OPTION_GROUP_WITH_OPTIONS_SELECT)
    .order("name", { ascending: true });
  if (error || !data) return [];
  return withSortedOptionGroups((data as unknown) as OfficialMenuOptionGroup[]);
}

export async function fetchOfficialMenuOptionGroupById(id: string): Promise<OfficialMenuOptionGroup | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("official_menu_option_groups")
    .select(OPTION_GROUP_WITH_OPTIONS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return withSortedOptionGroups([(data as unknown) as OfficialMenuOptionGroup])[0] ?? null;
}

export async function createOfficialMenuOptionGroupDraft(): Promise<OfficialMenuOptionGroup | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("official_menu_option_groups")
    .insert({
      name: "新规格组",
      required: false,
      min_select: 0,
      max_select: 1,
      is_active: false,
    })
    .select(OPTION_GROUP_WITH_OPTIONS_SELECT)
    .single();
  if (error || !data) return null;
  return withSortedOptionGroups([(data as unknown) as OfficialMenuOptionGroup])[0] ?? null;
}

function parseIntOr(raw: string, fallback = 0): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export async function updateOfficialMenuOptionGroup(args: {
  id: string;
  name: string;
  required: boolean;
  minSelect: string;
  maxSelect: string;
  isActive: boolean;
  options: Array<{ name: string; priceDelta: number }>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const minSelect = Math.max(0, parseIntOr(args.minSelect, 0));
  const maxSelect = Math.max(0, parseIntOr(args.maxSelect, 1));
  if (minSelect > maxSelect) return { ok: false, message: "最小选择数不能大于最大选择数" };
  if (args.required && minSelect < 1) return { ok: false, message: "必选组最小选择数需至少为 1" };

  const { error: groupError } = await supabase
    .from("official_menu_option_groups")
    .update({
      name: args.name.trim() || "未命名规格组",
      required: args.required,
      min_select: minSelect,
      max_select: maxSelect,
      is_active: args.isActive,
    })
    .eq("id", args.id);
  if (groupError) return { ok: false, message: groupError.message || "保存规格组失败" };

  const { error: deleteError } = await supabase.from("official_menu_option_options").delete().eq("group_id", args.id);
  if (deleteError) return { ok: false, message: deleteError.message || "保存规格项失败" };

  if (args.options.length > 0) {
    const rows = args.options.map((opt, idx) => ({
      group_id: args.id,
      name: opt.name.trim(),
      price_delta: Number.isFinite(opt.priceDelta) ? opt.priceDelta : 0,
      sort: idx + 1,
    }));
    const { error: insertError } = await supabase.from("official_menu_option_options").insert(rows);
    if (insertError) return { ok: false, message: insertError.message || "保存规格项失败" };
  }

  return { ok: true };
}

export async function deleteOfficialMenuOptionGroup(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { error } = await supabase.from("official_menu_option_groups").delete().eq("id", id);
  if (error) return { ok: false, message: error.message || "删除失败" };
  return { ok: true };
}

export async function fetchOfficialMenuItems(itemType?: "ala_carte" | "combo"): Promise<OfficialMenuItem[]> {
  const client = supabase;
  if (!client) return [];
  const run = async (selectText: string) => {
    let query = client
      .from("official_menu_items")
      .select(selectText)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false });
    if (itemType) query = query.eq("item_type", itemType);
    return query;
  };

  const first = await run(MENU_ITEM_SELECT_WITH_IMAGE);
  if (!first.error && first.data) {
    return ((first.data as unknown) as OfficialMenuItem[]).map((row) => withDefaultImage(row));
  }
  if (!isMissingImageUrlColumnError(first.error)) return [];

  const fallback = await run(MENU_ITEM_BASE_SELECT);
  if (fallback.error || !fallback.data) return [];
  return ((fallback.data as unknown) as OfficialMenuItem[]).map((row) => withDefaultImage(row));
}

export async function fetchOfficialMenuItemById(id: string): Promise<OfficialMenuItem | null> {
  if (!supabase) return null;
  const first = await supabase.from("official_menu_items").select(MENU_ITEM_SELECT_WITH_IMAGE).eq("id", id).maybeSingle();
  if (!first.error && first.data) return withDefaultImage((first.data as unknown) as OfficialMenuItem);
  if (!isMissingImageUrlColumnError(first.error)) return null;

  const fallback = await supabase.from("official_menu_items").select(MENU_ITEM_BASE_SELECT).eq("id", id).maybeSingle();
  if (fallback.error || !fallback.data) return null;
  return withDefaultImage((fallback.data as unknown) as OfficialMenuItem);
}

export async function fetchOfficialMenuItemOptionGroupIds(itemId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("official_menu_item_option_groups").select("group_id").eq("item_id", itemId);
  if (error || !data) return [];
  return (data as Array<{ group_id: string }>).map((r) => r.group_id);
}

async function fetchOfficialMenuItemOptionPriceOverrideRows(itemIds?: string[]): Promise<OfficialMenuItemOptionPriceOverride[]> {
  if (!supabase) return [];
  let query = supabase.from("official_menu_item_option_price_overrides").select("item_id,group_id,option_id,price_delta");
  if (itemIds && itemIds.length > 0) query = query.in("item_id", itemIds);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as unknown) as OfficialMenuItemOptionPriceOverride[];
}

export async function fetchOfficialMenuItemOptionGroupBindings(itemId: string): Promise<OfficialMenuItemOptionGroupBinding[]> {
  if (!supabase) return [];
  const [{ data: bindingRows, error: bindingError }, overrideRows] = await Promise.all([
    supabase.from("official_menu_item_option_groups").select("item_id,group_id").eq("item_id", itemId),
    fetchOfficialMenuItemOptionPriceOverrideRows([itemId]),
  ]);
  if (bindingError || !bindingRows) return [];
  return (bindingRows as Array<{ item_id: string; group_id: string }>).map((row) => ({
    item_id: row.item_id,
    group_id: row.group_id,
    option_price_overrides: overrideRows
      .filter((override) => override.item_id === row.item_id && override.group_id === row.group_id)
      .reduce<Record<string, number>>((acc, override) => {
        acc[override.option_id] = normalizeMoneyNumber(override.price_delta);
        return acc;
      }, {}),
  }));
}

export async function fetchOfficialMenuItemOptionGroupMap(itemIds?: string[]): Promise<Record<string, string[]>> {
  if (!supabase) return {};
  let query = supabase.from("official_menu_item_option_groups").select("item_id,group_id");
  if (itemIds && itemIds.length > 0) query = query.in("item_id", itemIds);
  const { data, error } = await query;
  if (error || !data) return {};
  return (data as Array<{ item_id: string; group_id: string }>).reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.item_id]) acc[row.item_id] = [];
    acc[row.item_id].push(row.group_id);
    return acc;
  }, {});
}

export async function fetchOfficialMenuItemsWithOptionGroups(itemType?: "ala_carte" | "combo"): Promise<OfficialMenuItemWithOptionGroups[]> {
  const items = await fetchOfficialMenuItems(itemType);
  if (items.length === 0) return [];
  const [groups, optionGroupMap, overrideRows] = await Promise.all([
    fetchOfficialMenuOptionGroups(),
    fetchOfficialMenuItemOptionGroupMap(items.map((item) => item.id)),
    fetchOfficialMenuItemOptionPriceOverrideRows(items.map((item) => item.id)),
  ]);
  const overrideMap = new Map(
    overrideRows.map((row) => [`${row.item_id}:${row.group_id}:${row.option_id}`, normalizeMoneyNumber(row.price_delta)]),
  );
  const activeGroupMap = new Map(
    withSortedOptionGroups(groups)
      .filter((group) => group.is_active)
      .map((group) => [group.id, group] satisfies [string, OfficialMenuOptionGroup]),
  );
  return items.map((item) => {
    const optionGroupIds = (optionGroupMap[item.id] ?? []).filter((groupId) => activeGroupMap.has(groupId));
    return {
      ...item,
      option_group_ids: optionGroupIds,
      option_groups: optionGroupIds
        .map((groupId) => {
          const group = activeGroupMap.get(groupId);
          if (!group) return null;
          return {
            ...group,
            official_menu_option_options: (group.official_menu_option_options ?? []).map((option) => ({
              ...option,
              price_delta: overrideMap.get(`${item.id}:${groupId}:${option.id}`) ?? normalizeMoneyNumber(option.price_delta),
            })),
          };
        })
        .filter(Boolean) as OfficialMenuOptionGroup[],
    };
  });
}

export async function fetchOfficialMenuComboComponentIds(comboItemId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_menu_combo_components")
    .select("component_item_id")
    .eq("combo_item_id", comboItemId);
  if (error || !data) return [];
  return (data as Array<{ component_item_id: string }>).map((r) => r.component_item_id);
}

export async function createOfficialMenuComboDraft(): Promise<OfficialMenuItem | null> {
  if (!supabase) return null;
  const nextSort = await fetchNextOfficialMenuItemSort("combo");
  const payloadWithImage = {
    name: "新套餐",
    description: "",
    image_url: null,
    category_id: null,
    item_type: "combo" as const,
    base_price: 0,
    sort: nextSort,
    tags: [],
    is_active: false,
  };
  const first = await supabase.from("official_menu_items").insert(payloadWithImage).select(MENU_ITEM_SELECT_WITH_IMAGE).single();
  if (!first.error && first.data) return withDefaultImage((first.data as unknown) as OfficialMenuItem);
  if (!isMissingImageUrlColumnError(first.error)) return null;

  const { image_url: _imageUrl, ...payloadWithoutImage } = payloadWithImage;
  void _imageUrl;
  const fallback = await supabase.from("official_menu_items").insert(payloadWithoutImage).select(MENU_ITEM_BASE_SELECT).single();
  if (fallback.error || !fallback.data) return null;
  return withDefaultImage((fallback.data as unknown) as OfficialMenuItem);
}

export async function updateOfficialMenuCombo(args: {
  id: string;
  name: string;
  basePrice: string;
  isActive: boolean;
  componentIds: string[];
  optionGroupBindings: Array<{
    groupId: string;
    optionPriceOverrides: Array<{ optionId: string; priceDelta: number }>;
  }>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };

  const { error: comboError } = await supabase
    .from("official_menu_items")
    .update({
      name: args.name.trim() || "未命名套餐",
      item_type: "combo",
      base_price: parseDecimalNumber(args.basePrice, 0),
      is_active: args.isActive,
    })
    .eq("id", args.id);
  if (comboError) return { ok: false, message: comboError.message || "保存套餐失败" };

  const { error: deleteComponentError } = await supabase.from("official_menu_combo_components").delete().eq("combo_item_id", args.id);
  if (deleteComponentError) return { ok: false, message: deleteComponentError.message || "保存套餐组件失败" };
  if (args.componentIds.length > 0) {
    const componentRows = args.componentIds.map((componentItemId) => ({ combo_item_id: args.id, component_item_id: componentItemId }));
    const { error: insertComponentError } = await supabase.from("official_menu_combo_components").insert(componentRows);
    if (insertComponentError) return { ok: false, message: insertComponentError.message || "保存套餐组件失败" };
  }

  const { error: deleteGroupError } = await supabase.from("official_menu_item_option_groups").delete().eq("item_id", args.id);
  if (deleteGroupError) return { ok: false, message: deleteGroupError.message || "保存规格绑定失败" };
  const { error: deleteOverrideError } = await supabase.from("official_menu_item_option_price_overrides").delete().eq("item_id", args.id);
  if (deleteOverrideError && !isMissingOptionPriceOverrideTableError(deleteOverrideError)) {
    return { ok: false, message: deleteOverrideError.message || "保存规格绑定失败" };
  }
  if (args.optionGroupBindings.length > 0) {
    const groupRows = args.optionGroupBindings.map((binding) => ({ item_id: args.id, group_id: binding.groupId }));
    const { error: insertGroupError } = await supabase.from("official_menu_item_option_groups").insert(groupRows);
    if (insertGroupError) return { ok: false, message: insertGroupError.message || "保存规格绑定失败" };
  }

  const overrideRows = args.optionGroupBindings.flatMap((binding) =>
    binding.optionPriceOverrides.map((override) => ({
      item_id: args.id,
      group_id: binding.groupId,
      option_id: override.optionId,
      price_delta: normalizeMoneyNumber(override.priceDelta),
    })),
  );
  if (overrideRows.length > 0) {
    const { error: insertOverrideError } = await supabase.from("official_menu_item_option_price_overrides").insert(overrideRows);
    if (insertOverrideError && !isMissingOptionPriceOverrideTableError(insertOverrideError)) {
      return { ok: false, message: insertOverrideError.message || "保存规格绑定失败" };
    }
  }

  return { ok: true };
}

function parseDecimalNumber(raw: string, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

function normalizeTags(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function createOfficialMenuItemDraft(): Promise<OfficialMenuItem | null> {
  if (!supabase) return null;
  const nextSort = await fetchNextOfficialMenuItemSort("ala_carte");
  const payloadWithImage = {
    name: "新单品",
    description: "",
    image_url: null,
    category_id: null,
    item_type: "ala_carte" as const,
    base_price: 0,
    sort: nextSort,
    tags: [],
    is_active: false,
  };
  const first = await supabase.from("official_menu_items").insert(payloadWithImage).select(MENU_ITEM_SELECT_WITH_IMAGE).single();
  if (!first.error && first.data) return withDefaultImage((first.data as unknown) as OfficialMenuItem);
  if (!isMissingImageUrlColumnError(first.error)) return null;

  const { image_url: _imageUrl, ...payloadWithoutImage } = payloadWithImage;
  void _imageUrl;
  const fallback = await supabase.from("official_menu_items").insert(payloadWithoutImage).select(MENU_ITEM_BASE_SELECT).single();
  if (fallback.error || !fallback.data) return null;
  return withDefaultImage((fallback.data as unknown) as OfficialMenuItem);
}

export async function updateOfficialMenuItem(args: {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  basePrice: string;
  tagsText: string;
  isActive: boolean;
  optionGroupBindings: Array<{
    groupId: string;
    optionPriceOverrides: Array<{ optionId: string; priceDelta: number }>;
  }>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };

  const payloadWithImage = {
    name: args.name.trim() || "未命名单品",
    description: args.description.trim() ? args.description.trim() : null,
    image_url: args.imageUrl.trim() ? args.imageUrl.trim() : null,
    category_id: args.categoryId || null,
    base_price: parseDecimalNumber(args.basePrice, 0),
    tags: normalizeTags(args.tagsText),
    is_active: args.isActive,
  };

  const first = await supabase.from("official_menu_items").update(payloadWithImage).eq("id", args.id);
  if (first.error && !isMissingImageUrlColumnError(first.error)) return { ok: false, message: first.error.message || "保存失败" };
  if (first.error && isMissingImageUrlColumnError(first.error)) {
    const { image_url: _imageUrl, ...payloadWithoutImage } = payloadWithImage;
    void _imageUrl;
    const fallback = await supabase.from("official_menu_items").update(payloadWithoutImage).eq("id", args.id);
    if (fallback.error) return { ok: false, message: fallback.error.message || "保存失败" };
  }

  const { error: deleteError } = await supabase.from("official_menu_item_option_groups").delete().eq("item_id", args.id);
  if (deleteError) return { ok: false, message: deleteError.message || "保存规格绑定失败" };
  const { error: deleteOverrideError } = await supabase.from("official_menu_item_option_price_overrides").delete().eq("item_id", args.id);
  if (deleteOverrideError && !isMissingOptionPriceOverrideTableError(deleteOverrideError)) {
    return { ok: false, message: deleteOverrideError.message || "保存规格绑定失败" };
  }

  if (args.optionGroupBindings.length > 0) {
    const rows = args.optionGroupBindings.map((binding) => ({ item_id: args.id, group_id: binding.groupId }));
    const { error: bindError } = await supabase.from("official_menu_item_option_groups").insert(rows);
    if (bindError) return { ok: false, message: bindError.message || "保存规格绑定失败" };
  }

  const overrideRows = args.optionGroupBindings.flatMap((binding) =>
    binding.optionPriceOverrides.map((override) => ({
      item_id: args.id,
      group_id: binding.groupId,
      option_id: override.optionId,
      price_delta: normalizeMoneyNumber(override.priceDelta),
    })),
  );
  if (overrideRows.length > 0) {
    const { error: bindOverrideError } = await supabase.from("official_menu_item_option_price_overrides").insert(overrideRows);
    if (bindOverrideError && !isMissingOptionPriceOverrideTableError(bindOverrideError)) {
      return { ok: false, message: bindOverrideError.message || "保存规格绑定失败" };
    }
  }

  return { ok: true };
}

export async function deleteOfficialMenuItem(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { error } = await supabase.from("official_menu_items").delete().eq("id", id);
  if (error) return { ok: false, message: error.message || "删除失败" };
  return { ok: true };
}

export async function setOfficialMenuItemActiveStatus(
  id: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { error } = await supabase.from("official_menu_items").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, message: error.message || "更新状态失败" };
  return { ok: true };
}

export async function reorderOfficialMenuItems(idsInOrder: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  for (let i = 0; i < idsInOrder.length; i += 1) {
    const { error } = await supabase
      .from("official_menu_items")
      .update({ sort: i + 1 })
      .eq("id", idsInOrder[i]);
    if (error) return { ok: false, message: error.message || "排序保存失败" };
  }
  return { ok: true };
}
