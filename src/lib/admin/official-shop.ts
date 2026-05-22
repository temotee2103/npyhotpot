import { supabase } from "@/lib/supabase";

export type OfficialCurrencyCode = "MYR" | "SGD";

export type OfficialSoupPackVariant = {
  id: string;
  sku: string;
  title: string;
  subtitle: string | null;
  image_url?: string | null;
  images?: string[];
  usage_text?: string | null;
  storage_text?: string | null;
  notice_text?: string | null;
  weight_kg: number;
  stock: number;
  status: "draft" | "pending_review" | "active";
  tags: string[];
  prices: Partial<Record<OfficialCurrencyCode, number>>;
};

export type OfficialShopBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_text: string | null;
  cta_href: string | null;
  sort: number;
  is_active: boolean;
  created_at: string;
};

export type OfficialShopShippingRate = {
  id: string;
  currency: "MYR" | "SGD";
  country: "MY" | "SG";
  fee: number;
  is_active: boolean;
};

export type OfficialDiscount = {
  id: string;
  channel: "shop" | "delivery";
  code: string;
  title: string;
  status: "enabled" | "disabled";
  discount_type: "percent" | "fixed";
  percent_off: number | null;
  myr_amount_off: number | null;
  sgd_amount_off: number | null;
  myr_min_spend: number | null;
  sgd_min_spend: number | null;
  stackable: boolean;
};

export type OfficialBundle = {
  id: string;
  code: string;
  title: string;
  image_url?: string | null;
  status: "draft" | "active";
  rule_kind: "buy_x_get_y" | "fixed_bundle";
  buy_qty: number | null;
  free_qty: number | null;
  pricing_mode: "auto" | "manual";
  myr_price: number | null;
  sgd_price: number | null;
  tags: string[];
};

export type OfficialBundleItem = {
  bundle_id: string;
  variant_id: string;
  quantity: number;
  official_soup_pack_variants?: { sku: string; title: string } | null;
};

type OfficialSoupPackPriceRow = {
  currency: string;
  price: number;
};

type OfficialSoupPackVariantImageRow = {
  url: string;
  sort: number;
};

type OfficialSoupPackVariantRow = {
  id: string;
  sku: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  usage_text: string | null;
  storage_text: string | null;
  notice_text: string | null;
  weight_kg: number;
  stock: number;
  status: "draft" | "pending_review" | "active";
  tags: string[] | null;
  official_soup_pack_prices: OfficialSoupPackPriceRow[] | null;
  official_soup_pack_variant_images?: OfficialSoupPackVariantImageRow[] | null;
};

export async function fetchOfficialSoupPackVariants(): Promise<OfficialSoupPackVariant[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("official_soup_pack_variants")
    .select(
      "id,sku,title,subtitle,image_url,usage_text,storage_text,notice_text,weight_kg,stock,status,tags,official_soup_pack_prices(currency,price),official_soup_pack_variant_images(url,sort)",
    )
    .order("sku", { ascending: true });

  if (error || !data) return [];

  const rows = data as unknown as OfficialSoupPackVariantRow[];

  return rows.map((row) => {
    const rawPrices = row.official_soup_pack_prices;
    const prices: Partial<Record<OfficialCurrencyCode, number>> = {};
    for (const p of rawPrices ?? []) {
      if (p.currency === "MYR" || p.currency === "SGD") prices[p.currency] = Number(p.price);
    }
    const images = [...(row.official_soup_pack_variant_images ?? [])]
      .sort((a, b) => Number(a.sort) - Number(b.sort))
      .map((x) => x.url)
      .filter(Boolean);

    return {
      id: row.id,
      sku: row.sku,
      title: row.title,
      subtitle: row.subtitle,
      image_url: row.image_url ?? null,
      images,
      usage_text: row.usage_text ?? null,
      storage_text: row.storage_text ?? null,
      notice_text: row.notice_text ?? null,
      weight_kg: Number(row.weight_kg ?? 0),
      stock: row.stock,
      status: row.status,
      tags: row.tags ?? [],
      prices,
    };
  });
}

export async function fetchOfficialSoupPackVariantById(id: string): Promise<OfficialSoupPackVariant | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("official_soup_pack_variants")
    .select(
      "id,sku,title,subtitle,image_url,usage_text,storage_text,notice_text,weight_kg,stock,status,tags,official_soup_pack_prices(currency,price),official_soup_pack_variant_images(url,sort)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as OfficialSoupPackVariantRow;
  const rawPrices = row.official_soup_pack_prices;
  const prices: Partial<Record<OfficialCurrencyCode, number>> = {};
  for (const p of rawPrices ?? []) {
    if (p.currency === "MYR" || p.currency === "SGD") prices[p.currency] = Number(p.price);
  }
  const images = [...(row.official_soup_pack_variant_images ?? [])]
    .sort((a, b) => Number(a.sort) - Number(b.sort))
    .map((x) => x.url)
    .filter(Boolean);

  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    subtitle: row.subtitle,
    image_url: row.image_url ?? null,
    images,
    usage_text: row.usage_text ?? null,
    storage_text: row.storage_text ?? null,
    notice_text: row.notice_text ?? null,
    weight_kg: Number(row.weight_kg ?? 0),
    stock: row.stock,
    status: row.status,
    tags: row.tags ?? [],
    prices,
  };
}

export async function fetchOfficialShopBanners(): Promise<OfficialShopBanner[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_shop_banners")
    .select("id,title,subtitle,image_url,cta_text,cta_href,sort,is_active,created_at")
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as OfficialShopBanner[]).filter((b) => Boolean(b.is_active));
}

export async function fetchOfficialShopBannersAdmin(): Promise<OfficialShopBanner[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_shop_banners")
    .select("id,title,subtitle,image_url,cta_text,cta_href,sort,is_active,created_at")
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as OfficialShopBanner[];
}

export async function fetchOfficialShopBannerById(id: string): Promise<OfficialShopBanner | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("official_shop_banners")
    .select("id,title,subtitle,image_url,cta_text,cta_href,sort,is_active,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as OfficialShopBanner;
}

export async function createOfficialShopBannerDraft(): Promise<OfficialShopBanner | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("official_shop_banners")
    .insert({
      title: "限时优惠",
      subtitle: "",
      image_url: null,
      cta_text: "立即购买",
      cta_href: "/shop",
      sort: 0,
      is_active: false,
    })
    .select("id,title,subtitle,image_url,cta_text,cta_href,sort,is_active,created_at")
    .single();
  if (error || !data) return null;
  return data as unknown as OfficialShopBanner;
}

export async function updateOfficialShopBanner(args: {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  ctaText: string;
  ctaHref: string;
  sort: string;
  isActive: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const s = Math.max(0, parseIntNumber(args.sort, 0));
  const { error } = await supabase
    .from("official_shop_banners")
    .update({
      title: args.title.trim() || "限时优惠",
      subtitle: args.subtitle.trim() ? args.subtitle.trim() : null,
      image_url: args.imageUrl && args.imageUrl.trim() ? args.imageUrl.trim() : null,
      cta_text: args.ctaText.trim() ? args.ctaText.trim() : null,
      cta_href: args.ctaHref.trim() ? args.ctaHref.trim() : null,
      sort: s,
      is_active: args.isActive,
    })
    .eq("id", args.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteOfficialShopBanner(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { error } = await supabase.from("official_shop_banners").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchOfficialShopShippingRates(): Promise<OfficialShopShippingRate[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_shop_shipping_rates")
    .select("id,currency,country,fee,is_active")
    .order("currency", { ascending: true })
    .order("country", { ascending: true });
  if (error || !data) return [];
  return (data as unknown as Array<{ id: string; currency: "MYR" | "SGD"; country: "MY" | "SG"; fee: number; is_active: boolean }>).map((r) => ({
    id: r.id,
    currency: r.currency,
    country: r.country,
    fee: Number(r.fee ?? 0),
    is_active: Boolean(r.is_active),
  }));
}

export async function upsertOfficialShopShippingRate(args: {
  currency: "MYR" | "SGD";
  country: "MY" | "SG";
  fee: string;
  isActive: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const fee = Math.max(0, parseNumber(args.fee, 0));
  const { error } = await supabase
    .from("official_shop_shipping_rates")
    .upsert(
      { currency: args.currency, country: args.country, fee, is_active: args.isActive },
      { onConflict: "currency,country" },
    );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchOfficialSoupPackVariantImages(variantId: string): Promise<Array<{ id: string; url: string; sort: number }>> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_soup_pack_variant_images")
    .select("id,url,sort")
    .eq("variant_id", variantId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as unknown) as Array<{ id: string; url: string; sort: number }>;
}

export async function createOfficialSoupPackVariantImage(args: {
  variantId: string;
  url: string;
  sort: number;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { data, error } = await supabase
    .from("official_soup_pack_variant_images")
    .insert({ variant_id: args.variantId, url: args.url, sort: args.sort })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "创建失败" };
  return { ok: true, id: (data as { id: string }).id };
}

export async function deleteOfficialSoupPackVariantImage(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { error } = await supabase.from("official_soup_pack_variant_images").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchOfficialBundles(): Promise<OfficialBundle[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("official_soup_pack_bundles")
    .select("id,code,title,image_url,status,rule_kind,buy_qty,free_qty,pricing_mode,myr_price,sgd_price,tags")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown) as OfficialBundle[];
}

export async function fetchOfficialBundleById(id: string): Promise<OfficialBundle | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("official_soup_pack_bundles")
    .select("id,code,title,image_url,status,rule_kind,buy_qty,free_qty,pricing_mode,myr_price,sgd_price,tags")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return (data as unknown) as OfficialBundle;
}

export async function fetchOfficialBundleItems(bundleId: string): Promise<OfficialBundleItem[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("official_soup_pack_bundle_items")
    .select("bundle_id,variant_id,quantity,official_soup_pack_variants(sku,title)")
    .eq("bundle_id", bundleId);

  if (error || !data) return [];
  return (data as unknown) as OfficialBundleItem[];
}

export async function fetchOfficialDiscounts(channel: "shop" | "delivery" = "shop"): Promise<OfficialDiscount[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("official_discounts")
    .select("id,channel,code,title,status,discount_type,percent_off,myr_amount_off,sgd_amount_off,myr_min_spend,sgd_min_spend,stackable")
    .eq("channel", channel)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown) as OfficialDiscount[];
}

export async function fetchOfficialDiscountById(id: string, channel: "shop" | "delivery" = "shop"): Promise<OfficialDiscount | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("official_discounts")
    .select("id,channel,code,title,status,discount_type,percent_off,myr_amount_off,sgd_amount_off,myr_min_spend,sgd_min_spend,stackable")
    .eq("id", id)
    .eq("channel", channel)
    .maybeSingle();

  if (error || !data) return null;
  return (data as unknown) as OfficialDiscount;
}

function generateCode(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

export async function createOfficialSoupPackVariantDraft(): Promise<{ id: string } | null> {
  if (!supabase) return null;

  const sku = generateCode("SP");
  const { data, error } = await supabase
    .from("official_soup_pack_variants")
    .insert({ sku, title: "新商品", status: "draft", stock: 0, weight_kg: 0, tags: [] })
    .select("id")
    .single();

  if (error || !data) return null;

  await supabase.from("official_soup_pack_prices").upsert(
    [
      { variant_id: data.id, currency: "MYR", price: 0 },
      { variant_id: data.id, currency: "SGD", price: 0 },
    ],
    { onConflict: "variant_id,currency" },
  );

  return { id: data.id as string };
}

export async function createOfficialBundleDraft(): Promise<{ id: string } | null> {
  if (!supabase) return null;

  const code = generateCode("BND");
  const { data, error } = await supabase
    .from("official_soup_pack_bundles")
    .insert({
      code,
      title: "新 Bundle",
      status: "draft",
      rule_kind: "buy_x_get_y",
      buy_qty: 0,
      free_qty: 0,
      pricing_mode: "auto",
      tags: [],
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return { id: data.id as string };
}

export async function createOfficialDiscountDraft(channel: "shop" | "delivery" = "shop"): Promise<{ id: string } | null> {
  if (!supabase) return null;

  const code = generateCode("DISC");
  const { data, error } = await supabase
    .from("official_discounts")
    .insert({
      channel,
      code,
      title: "新 Discount",
      status: "enabled",
      discount_type: "percent",
      percent_off: 0,
      stackable: false,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return { id: data.id as string };
}

function parseNumber(value: string, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function parseIntNumber(value: string, fallback = 0) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export async function updateOfficialSoupPackVariant(args: {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  usageText?: string;
  storageText?: string;
  noticeText?: string;
  weightKg: string;
  status: "draft" | "pending_review" | "active";
  stock: string;
  tagsText: string;
  myr: string;
  sgd: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  if (!args.id) return { ok: false, message: "缺少商品ID" };

  const tags = args.tagsText
    .split("，")
    .map((t) => t.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("official_soup_pack_variants")
    .update({
      title: args.title.trim() || "未命名商品",
      subtitle: args.subtitle.trim() ? args.subtitle.trim() : null,
      image_url: args.imageUrl && args.imageUrl.trim() ? args.imageUrl.trim() : null,
      usage_text: args.usageText && args.usageText.trim() ? args.usageText.trim() : null,
      storage_text: args.storageText && args.storageText.trim() ? args.storageText.trim() : null,
      notice_text: args.noticeText && args.noticeText.trim() ? args.noticeText.trim() : null,
      weight_kg: Math.max(0, parseNumber(args.weightKg, 0)),
      stock: Math.max(0, parseIntNumber(args.stock, 0)),
      status: args.status,
      tags,
    })
    .eq("id", args.id);

  if (error) return { ok: false, message: error.message };

  const priceRows = [
    { variant_id: args.id, currency: "MYR", price: Math.max(0, parseNumber(args.myr, 0)) },
    { variant_id: args.id, currency: "SGD", price: Math.max(0, parseNumber(args.sgd, 0)) },
  ];
  const priceResult = await supabase.from("official_soup_pack_prices").upsert(priceRows, { onConflict: "variant_id,currency" });
  if (priceResult.error) return { ok: false, message: priceResult.error.message };

  return { ok: true };
}

export async function updateOfficialBundle(args: {
  id: string;
  code: string;
  title: string;
  imageUrl?: string;
  status: "draft" | "active";
  rule_kind: "buy_x_get_y" | "fixed_bundle";
  buy_qty: string;
  free_qty: string;
  pricing_mode: "auto" | "manual";
  myr_price: string;
  sgd_price: string;
  tags: string[];
  itemsByVariantId: Record<string, number>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  if (!args.id) return { ok: false, message: "缺少Bundle ID" };

  const buyQty = Math.max(0, parseIntNumber(args.buy_qty, 0));
  const freeQty = Math.max(0, parseIntNumber(args.free_qty, 0));
  const myrPrice = Math.max(0, parseNumber(args.myr_price, 0));
  const sgdPrice = Math.max(0, parseNumber(args.sgd_price, 0));

  const { error } = await supabase
    .from("official_soup_pack_bundles")
    .update({
      code: args.code.trim() || generateCode("BND"),
      title: args.title.trim() || "未命名 Bundle",
      image_url: args.imageUrl && args.imageUrl.trim() ? args.imageUrl.trim() : null,
      status: args.status,
      rule_kind: args.rule_kind,
      buy_qty: args.rule_kind === "buy_x_get_y" ? buyQty : null,
      free_qty: args.rule_kind === "buy_x_get_y" ? freeQty : null,
      pricing_mode: args.pricing_mode,
      myr_price: args.pricing_mode === "manual" ? myrPrice : null,
      sgd_price: args.pricing_mode === "manual" ? sgdPrice : null,
      tags: args.tags ?? [],
    })
    .eq("id", args.id);

  if (error) return { ok: false, message: error.message };

  const deleteResult = await supabase.from("official_soup_pack_bundle_items").delete().eq("bundle_id", args.id);
  if (deleteResult.error) return { ok: false, message: deleteResult.error.message };

  const insertRows = Object.entries(args.itemsByVariantId)
    .map(([variantId, qty]) => ({ bundle_id: args.id, variant_id: variantId, quantity: qty }))
    .filter((row) => row.quantity > 0);

  if (insertRows.length > 0) {
    const insertResult = await supabase.from("official_soup_pack_bundle_items").insert(insertRows);
    if (insertResult.error) return { ok: false, message: insertResult.error.message };
  }

  return { ok: true };
}

export async function updateOfficialDiscount(args: {
  id: string;
  channel: "shop" | "delivery";
  title: string;
  code: string;
  status: "enabled" | "disabled";
  stackable: boolean;
  discount_type: "percent" | "fixed";
  percent_off: string;
  myr_amount_off: string;
  sgd_amount_off: string;
  myr_min_spend: string;
  sgd_min_spend: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  if (!args.id) return { ok: false, message: "缺少Discount ID" };

  const percent = Math.max(0, parseNumber(args.percent_off, 0));
  const myrOff = Math.max(0, parseNumber(args.myr_amount_off, 0));
  const sgdOff = Math.max(0, parseNumber(args.sgd_amount_off, 0));
  const myrMin = Math.max(0, parseNumber(args.myr_min_spend, 0));
  const sgdMin = Math.max(0, parseNumber(args.sgd_min_spend, 0));

  const payload =
    args.discount_type === "percent"
      ? {
          channel: args.channel,
          code: args.code.trim() || generateCode("DISC"),
          title: args.title.trim() || "未命名 Discount",
          status: args.status,
          discount_type: "percent" as const,
          percent_off: percent,
          myr_amount_off: null,
          sgd_amount_off: null,
          myr_min_spend: myrMin,
          sgd_min_spend: sgdMin,
          stackable: args.stackable,
        }
      : {
          channel: args.channel,
          code: args.code.trim() || generateCode("DISC"),
          title: args.title.trim() || "未命名 Discount",
          status: args.status,
          discount_type: "fixed" as const,
          percent_off: null,
          myr_amount_off: myrOff,
          sgd_amount_off: sgdOff,
          myr_min_spend: myrMin,
          sgd_min_spend: sgdMin,
          stackable: args.stackable,
        };

  const { error } = await supabase.from("official_discounts").update(payload).eq("id", args.id).eq("channel", args.channel);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteOfficialSoupPackVariant(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  if (!id) return { ok: false, message: "缺少商品ID" };
  const { error } = await supabase.from("official_soup_pack_variants").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteOfficialBundle(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  if (!id) return { ok: false, message: "缺少Bundle ID" };
  const { error } = await supabase.from("official_soup_pack_bundles").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteOfficialDiscount(id: string, channel: "shop" | "delivery" = "shop"): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  if (!id) return { ok: false, message: "缺少Discount ID" };
  const { error } = await supabase.from("official_discounts").delete().eq("id", id).eq("channel", channel);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
