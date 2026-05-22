"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { UnifiedTable } from "@/components/unified-table";
import { UnifiedModal } from "@/components/unified-modal";

type ReportOrderRow = {
  id: string;
  user_id: string | null;
  channel: "shop" | "delivery";
  currency: "MYR" | "SGD";
  total: number;
  subtotal: number | null;
  outlet_id: string | null;
  ship_postcode: string | null;
  ship_address: string | null;
  created_at: string;
  status: string;
  official_outlets?: { name?: string | null } | null;
};

type ReportOrderItemRow = {
  order_id: string;
  item_type: "soup_pack_variant" | "menu_item" | "bundle";
  item_id: string;
  title: string | null;
  quantity: number;
  unit_price: number;
};

type BundleItemRow = {
  bundle_id: string;
  quantity: number;
};

type MenuItemCategoryRow = {
  id: string;
  name: string;
  official_menu_categories?: { name?: string | null } | null;
};

type ReportUserProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  membership_tier: "none" | "bronze" | "silver" | "gold";
  created_at: string;
};

type ReportDineInAccrualRow = {
  id: string;
  member_user_id: string;
  outlet_id: string;
  spend_amount: number;
  status: "submitted" | "approved" | "rejected";
  submitted_at: string;
  official_outlets?: { name?: string | null } | null;
};

type ReportPointsLedgerRow = {
  id: string;
  channel: "shop" | "delivery" | "dine_in" | "all";
  points_delta: number;
  reason: "self_earn" | "upline_rebate" | "redeem_deduction" | "admin_adjustment";
  source_type: string;
  source_id: string;
  created_at: string;
};

type DashboardDatum = {
  label: string;
  value: number;
  note?: string;
  sortKey?: string;
};

type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

type ReportsOverviewSummary = {
  shop?: {
    order_count?: number;
    revenue?: number;
    average_order_value?: number;
    member_order_count?: number;
    new_buyer_orders?: number;
    repeat_buyer_orders?: number;
    repeat_buyer_members?: number;
  } | null;
  delivery?: {
    order_count?: number;
    revenue?: number;
    average_order_value?: number;
    sold_pieces?: number;
    average_pieces?: number;
  } | null;
  member?: {
    active_member_count?: number;
    total_spend?: number;
    online_spend?: number;
    dine_in_spend?: number;
    dine_in_scans?: number;
    repeat_members?: number;
  } | null;
};

type DashboardRpcDatum = {
  label: string;
  value: number;
  note?: string;
  sort_key?: string;
};

type ReportsDashboardSummary = {
  shop?: {
    trend?: DashboardRpcDatum[] | null;
    currency_mix?: DashboardRpcDatum[] | null;
    region_sales?: DashboardRpcDatum[] | null;
    top_products?: DashboardRpcDatum[] | null;
  } | null;
  delivery?: {
    trend?: DashboardRpcDatum[] | null;
    daypart_mix?: DashboardRpcDatum[] | null;
    outlet_performance?: DashboardRpcDatum[] | null;
    category_mix?: DashboardRpcDatum[] | null;
  } | null;
  member?: {
    activity_trend?: DashboardRpcDatum[] | null;
    spend_mix?: DashboardRpcDatum[] | null;
    top_spenders?: DashboardRpcDatum[] | null;
    tier_distribution?: DashboardRpcDatum[] | null;
    channel_preference?: DashboardRpcDatum[] | null;
    outlet_visits?: DashboardRpcDatum[] | null;
  } | null;
};

function formatCompactValue(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function DashboardMetricCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "slate" | "primary" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/20 bg-primary/5 text-primary"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
          : "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100";

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-2 text-xs opacity-80">{hint}</p>
    </article>
  );
}

function TrendBars({
  title,
  subtitle,
  data,
  prefix = "",
  suffix = "",
  badge = "Last 14",
}: {
  title: string;
  subtitle: string;
  data: DashboardDatum[];
  prefix?: string;
  suffix?: string;
  badge?: string;
}) {
  const safeData = data.slice(-14);
  const max = Math.max(...safeData.map((item) => item.value), 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">{title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{subtitle}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">{badge}</span>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-3 sm:grid-cols-14">
        {safeData.map((item) => (
          <div key={`${item.sortKey ?? item.label}-${item.note ?? ""}`} className="flex flex-col items-center gap-2">
            <div className="flex h-36 w-full items-end justify-center rounded-xl bg-slate-100/70 px-1 dark:bg-slate-800/70">
              <div
                className="w-full rounded-lg bg-gradient-to-t from-primary via-primary/80 to-amber-300"
                style={{ height: `${Math.max(10, Math.round((item.value / max) * 120))}px` }}
                title={`${item.label}: ${prefix}${item.value.toFixed(2)}${suffix}`}
              />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100">{item.label}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-300">{prefix}{formatCompactValue(item.value)}{suffix}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({
  title,
  subtitle,
  data,
  prefix = "",
  suffix = "",
}: {
  title: string;
  subtitle: string;
  data: DashboardDatum[];
  prefix?: string;
  suffix?: string;
}) {
  const safeData = data.slice(0, 6);
  const max = Math.max(...safeData.map((item) => item.value), 1);

  return (
    <div className="rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] p-5 shadow-sm backdrop-blur-sm dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface-elevated)]">
      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-1 text-sm text-[color:var(--theme-muted)]">{subtitle}</p>
      <div className="mt-5 space-y-4">
        {safeData.map((item) => (
          <div key={`${item.label}-${item.note ?? ""}`} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">
                {prefix}{item.value.toFixed(2)}{suffix}
              </p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-amber-300"
                style={{ width: `${Math.max(6, (item.value / max) * 100)}%` }}
                title={`${item.label}: ${prefix}${item.value.toFixed(2)}${suffix}`}
              />
            </div>
            {item.note ? <p className="text-[11px] text-slate-500 dark:text-slate-300">{item.note}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutBreakdown({
  title,
  subtitle,
  slices,
  centerLabel,
}: {
  title: string;
  subtitle: string;
  slices: DonutSlice[];
  centerLabel: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let progress = 0;
  const gradient = slices
    .map((slice) => {
      const start = total > 0 ? (progress / total) * 360 : 0;
      progress += slice.value;
      const end = total > 0 ? (progress / total) * 360 : 0;
      return `${slice.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{subtitle}</p>
      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="relative mx-auto h-44 w-44">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: total > 0 ? `conic-gradient(${gradient})` : "conic-gradient(color-mix(in srgb, var(--theme-border-strong) 80%, white 20%) 0deg 360deg)" }}
          />
          <div className="absolute inset-6 flex items-center justify-center rounded-full bg-[color:var(--theme-surface-elevated)] text-center shadow-inner dark:bg-[color:var(--theme-surface-elevated)]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--theme-muted)]">Total</p>
              <p className="mt-1 text-2xl font-black">{centerLabel}</p>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {slices.map((slice) => {
            const percentage = total > 0 ? (slice.value / total) * 100 : 0;
            return (
              <div key={slice.label} className="rounded-xl border border-[color:var(--theme-border)] bg-black/2 px-4 py-3 dark:border-[color:var(--theme-border-strong)] dark:bg-white/4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
                    <p className="font-semibold text-[color:var(--foreground)]">{slice.label}</p>
                  </div>
                  <p className="text-sm font-bold text-[color:var(--theme-muted)]">{percentage.toFixed(1)}%</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function AdminReportsPage() {
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [activeChannel, setActiveChannel] = useState<"shop" | "delivery" | "member">("shop");
  const [trendGranularity, setTrendGranularity] = useState<"day" | "week" | "month">("day");
  const [shopView, setShopView] = useState<"dashboard" | "detail">("dashboard");
  const [deliveryView, setDeliveryView] = useState<"dashboard" | "detail">("dashboard");
  const [userView, setUserView] = useState<"dashboard" | "detail">("dashboard");
  const [userTierFilter, setUserTierFilter] = useState<"ALL" | "none" | "bronze" | "silver" | "gold">("ALL");
  const [userKeyword, setUserKeyword] = useState("");
  const [shopCurrency, setShopCurrency] = useState<"ALL" | "MYR" | "SGD">("ALL");
  const [shopRegion, setShopRegion] = useState<string>("ALL");
  const [deliveryOutlet, setDeliveryOutlet] = useState<string>("ALL");
  const [deliveryCategory, setDeliveryCategory] = useState<string>("ALL");
  const [selectedShopOrderIds, setSelectedShopOrderIds] = useState<string[]>([]);
  const [selectedDeliveryOrderIds, setSelectedDeliveryOrderIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userDetailModalUserId, setUserDetailModalUserId] = useState<string | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [userDetailPointsRows, setUserDetailPointsRows] = useState<ReportPointsLedgerRow[]>([]);
  const [userDetailOrderPage, setUserDetailOrderPage] = useState(1);
  const [userDetailDineInPage, setUserDetailDineInPage] = useState(1);
  const [userDetailPointsPage, setUserDetailPointsPage] = useState(1);
  const [userSegmentsSnapshotTime] = useState(() => Date.now());
  const [shopDetailModalOrderId, setShopDetailModalOrderId] = useState<string | null>(null);
  const [deliveryDetailModalOrderId, setDeliveryDetailModalOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ReportOrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<ReportOrderItemRow[]>([]);
  const [bundleItems, setBundleItems] = useState<BundleItemRow[]>([]);
  const [menuItemCategories, setMenuItemCategories] = useState<Map<string, string>>(new Map());
  const [userProfiles, setUserProfiles] = useState<ReportUserProfileRow[]>([]);
  const [dineInAccruals, setDineInAccruals] = useState<ReportDineInAccrualRow[]>([]);
  const [overviewSummary, setOverviewSummary] = useState<ReportsOverviewSummary | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<ReportsDashboardSummary | null>(null);

  const toDateStartISO = (raw: string) => new Date(`${raw}T00:00:00`).toISOString();
  const toDateEndISO = (raw: string) => new Date(`${raw}T23:59:59.999`).toISOString();
  const toNumber = (v: unknown) => Number(v ?? 0);
  const csvEscape = (value: string | number) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
  const formatCurrencyValue = (value: number) => `RM ${value.toFixed(2)}`;
  const getWeekStart = (date: Date) => {
    const next = new Date(date);
    const day = next.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    next.setDate(next.getDate() + diff);
    next.setHours(0, 0, 0, 0);
    return next;
  };
  const pad2 = (value: number) => String(value).padStart(2, "0");
  const formatBucketLabel = (date: Date, granularity: "day" | "week" | "month") => {
    if (granularity === "month") return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
    if (granularity === "week") return `周 ${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
    return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
  };
  const getBucketMeta = (raw: string, granularity: "day" | "week" | "month") => {
    const date = new Date(raw);
    if (granularity === "month") {
      const bucket = new Date(date.getFullYear(), date.getMonth(), 1);
      return {
        key: `${bucket.getFullYear()}-${pad2(bucket.getMonth() + 1)}`,
        label: formatBucketLabel(bucket, granularity),
      };
    }
    if (granularity === "week") {
      const bucket = getWeekStart(date);
      return {
        key: `${bucket.getFullYear()}-${pad2(bucket.getMonth() + 1)}-${pad2(bucket.getDate())}`,
        label: formatBucketLabel(bucket, granularity),
      };
    }
    return {
      key: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
      label: formatBucketLabel(date, granularity),
    };
  };
  const granularityLabel = trendGranularity === "day" ? "按日" : trendGranularity === "week" ? "按周" : "按月";
  const trendBadge = trendGranularity === "day" ? "Daily" : trendGranularity === "week" ? "Weekly" : "Monthly";
  const buildSeriesByGranularity = <T,>(
    rows: T[],
    getDate: (row: T) => string,
    getValue: (row: T) => number,
    granularity: "day" | "week" | "month",
    limit = granularity === "month" ? 12 : 14,
  ): DashboardDatum[] => {
    const map = new Map<string, number>();
    const labelMap = new Map<string, string>();
    for (const row of rows) {
      const bucket = getBucketMeta(getDate(row), granularity);
      map.set(bucket.key, (map.get(bucket.key) ?? 0) + getValue(row));
      labelMap.set(bucket.key, bucket.label);
    }
    return Array.from(map.entries())
      .map(([key, value]) => ({ label: labelMap.get(key) ?? key, value, sortKey: key }))
      .sort((a, b) => String(a.sortKey ?? "").localeCompare(String(b.sortKey ?? "")))
      .slice(-limit);
  };
  const buildUniqueMemberSeries = (
    rows: Array<{ memberId: string; eventAt: string }>,
    granularity: "day" | "week" | "month",
    limit = granularity === "month" ? 12 : 14,
  ): DashboardDatum[] => {
    const map = new Map<string, Set<string>>();
    const labelMap = new Map<string, string>();
    for (const row of rows) {
      const bucket = getBucketMeta(row.eventAt, granularity);
      const set = map.get(bucket.key) ?? new Set<string>();
      set.add(row.memberId);
      map.set(bucket.key, set);
      labelMap.set(bucket.key, bucket.label);
    }
    return Array.from(map.entries())
      .map(([key, members]) => ({ label: labelMap.get(key) ?? key, value: members.size, sortKey: key }))
      .sort((a, b) => String(a.sortKey ?? "").localeCompare(String(b.sortKey ?? "")))
      .slice(-limit);
  };
  const coerceDashboardData = (rows: DashboardRpcDatum[] | null | undefined): DashboardDatum[] =>
    (rows ?? []).map((row) => ({
      label: String(row.label ?? ""),
      value: Number(row.value ?? 0),
      note: row.note ? String(row.note) : undefined,
      sortKey: row.sort_key ? String(row.sort_key) : undefined,
    }));
  const normalizeRegion = (_postcode: string | null, address: string | null) => {
    const addr = (address ?? "").trim();
    if (!addr) return "未填写";
    if (addr.includes("|")) {
      const parts = addr.split("|").map((part) => part.trim()).filter(Boolean);
      const state = parts[3] || "";
      if (state) return state;
      const country = parts[4] || "";
      if (country) return country;
    }
    const parts = addr.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) return "未填写";
    if (parts.length === 1) return parts[0].slice(0, 14);
    const last = parts[parts.length - 1].toLowerCase();
    const countryTokens = new Set(["malaysia", "singapore", "china", "my", "sg", "cn", "马来西亚", "新加坡", "中国"]);
    const state = countryTokens.has(last) ? parts[parts.length - 2] : parts[parts.length - 1];
    return state || "未填写";
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 30);
      setRangeStart(formatDateInputValue(start));
      setRangeEnd(formatDateInputValue(end));
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const db = supabase;
    if (!db) return;
    if (!rangeStart || !rangeEnd) return;

    let active = true;
    const run = async () => {
      setLoading(true);
      const since = toDateStartISO(rangeStart);
      const until = toDateEndISO(rangeEnd);
      const [ordersRes, profilesRes, dineInRes, menuRes, bundleRes, summaryRes, dashboardRes] = await Promise.all([
        db
          .from("official_orders")
          .select("id,user_id,channel,currency,total,subtotal,outlet_id,ship_postcode,ship_address,created_at,status,official_outlets(name)")
          .gte("created_at", since)
          .lte("created_at", until)
          .order("created_at", { ascending: false })
          .limit(5000),
        db.from("official_profiles").select("id,full_name,phone,membership_tier,created_at").order("created_at", { ascending: false }).limit(5000),
        db
          .from("official_member_rewards_accruals")
          .select("id,member_user_id,outlet_id,spend_amount,status,submitted_at,official_outlets(name)")
          .gte("submitted_at", since)
          .lte("submitted_at", until)
          .order("submitted_at", { ascending: false })
          .limit(5000),
        db.from("official_menu_items").select("id,name,official_menu_categories(name)").limit(5000),
        db.from("official_soup_pack_bundle_items").select("bundle_id,quantity"),
        db.rpc("official_admin_reports_overview", {
          p_start: since,
          p_end: until,
        }),
        db.rpc("official_admin_reports_dashboard", {
          p_start: since,
          p_end: until,
          p_granularity: trendGranularity,
        }),
      ]);

      if (!active) return;

      const orderRows = (ordersRes.data ?? []) as unknown as ReportOrderRow[];
      const profileRows = (profilesRes.data ?? []) as unknown as ReportUserProfileRow[];
      const dineInRows = (dineInRes.data ?? []) as unknown as ReportDineInAccrualRow[];
      const menuRows = (menuRes.data ?? []) as unknown as MenuItemCategoryRow[];
      const bundleRows = (bundleRes.data ?? []) as unknown as BundleItemRow[];

      const orderIds = orderRows.map((row) => row.id);
      let itemRows: ReportOrderItemRow[] = [];
      if (orderIds.length > 0) {
        const itemsRes = await db
          .from("official_order_items")
          .select("order_id,item_type,item_id,title,quantity,unit_price")
          .in("order_id", orderIds);
        if (!active) return;
        itemRows = (itemsRes.data ?? []) as unknown as ReportOrderItemRow[];
      }

      const categoryMap = new Map<string, string>();
      for (const row of menuRows) {
        categoryMap.set(row.id, row.official_menu_categories?.name?.trim() || "未分类");
      }

      setOrders(orderRows);
      setUserProfiles(profileRows);
      setDineInAccruals(dineInRows);
      setOrderItems(itemRows);
      setBundleItems(bundleRows);
      setMenuItemCategories(categoryMap);
      setOverviewSummary(((summaryRes.data ?? null) as ReportsOverviewSummary | null) ?? null);
      setDashboardSummary(((dashboardRes.data ?? null) as ReportsDashboardSummary | null) ?? null);
      setLoading(false);
    };

    void run();
    return () => {
      active = false;
    };
  }, [rangeEnd, rangeStart, trendGranularity]);

  const itemsByOrderId = useMemo(() => {
    const map = new Map<string, ReportOrderItemRow[]>();
    for (const item of orderItems) {
      const rows = map.get(item.order_id) ?? [];
      rows.push(item);
      map.set(item.order_id, rows);
    }
    return map;
  }, [orderItems]);

  const orderById = useMemo(() => {
    const map = new Map<string, ReportOrderRow>();
    for (const order of orders) map.set(order.id, order);
    return map;
  }, [orders]);

  const bundleUnitsByBundleId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of bundleItems) {
      map.set(row.bundle_id, (map.get(row.bundle_id) ?? 0) + toNumber(row.quantity));
    }
    return map;
  }, [bundleItems]);

  const shopOrders = useMemo(() => {
    const source = orders.filter((o) => o.channel === "shop");
    return source.filter((o) => (shopCurrency === "ALL" ? true : o.currency === shopCurrency));
  }, [orders, shopCurrency]);

  const shopRegionOptions = useMemo(() => {
    return Array.from(new Set(shopOrders.map((order) => normalizeRegion(order.ship_postcode, order.ship_address)))).sort((a, b) => a.localeCompare(b, "zh"));
  }, [shopOrders]);
  const effectiveShopRegion = shopRegion === "ALL" || shopRegionOptions.includes(shopRegion) ? shopRegion : "ALL";

  const filteredShopOrders = useMemo(() => {
    return shopOrders.filter((order) => (effectiveShopRegion === "ALL" ? true : normalizeRegion(order.ship_postcode, order.ship_address) === effectiveShopRegion));
  }, [effectiveShopRegion, shopOrders]);

  const shopRevenue = useMemo(() => filteredShopOrders.reduce((sum, row) => sum + toNumber(row.total), 0), [filteredShopOrders]);

  const shopPackageCount = useMemo(() => {
    let total = 0;
    for (const order of filteredShopOrders) {
      const rows = itemsByOrderId.get(order.id) ?? [];
      for (const item of rows) {
        const qty = toNumber(item.quantity);
        if (item.item_type === "bundle") {
          const units = bundleUnitsByBundleId.get(item.item_id) ?? 1;
          total += qty * units;
        } else if (item.item_type === "soup_pack_variant") {
          total += qty;
        }
      }
    }
    return total;
  }, [bundleUnitsByBundleId, filteredShopOrders, itemsByOrderId]);

  const shopRegionSales = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of filteredShopOrders) {
      const region = normalizeRegion(order.ship_postcode, order.ship_address);
      map.set(region, (map.get(region) ?? 0) + toNumber(order.total));
    }
    return Array.from(map.entries())
      .map(([region, revenue]) => ({ region, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredShopOrders]);

  const shopDetailRows = useMemo(() => {
    return filteredShopOrders.map((order) => {
      const rows = itemsByOrderId.get(order.id) ?? [];
      let packageCount = 0;
      for (const item of rows) {
        if (item.item_type === "bundle") {
          packageCount += toNumber(item.quantity) * (bundleUnitsByBundleId.get(item.item_id) ?? 1);
        } else if (item.item_type === "soup_pack_variant") {
          packageCount += toNumber(item.quantity);
        }
      }
      const region = normalizeRegion(order.ship_postcode, order.ship_address);
      return {
        id: order.id,
        orderId: order.id.slice(0, 8).toUpperCase(),
        createdAt: new Date(order.created_at).toLocaleString("zh-CN", { hour12: false }),
        currency: order.currency,
        revenue: toNumber(order.total),
        region,
        packages: packageCount,
      };
    });
  }, [bundleUnitsByBundleId, filteredShopOrders, itemsByOrderId]);

  const deliveryOrders = useMemo(() => orders.filter((o) => o.channel === "delivery"), [orders]);

  const deliveryOutletOptions = useMemo(() => {
    return Array.from(
      new Set(
        deliveryOrders.map((order) => {
          const outletName = order.official_outlets?.name?.trim();
          return outletName || order.outlet_id || "未知分店";
        }),
      ),
    ).sort((a, b) => a.localeCompare(b, "zh"));
  }, [deliveryOrders]);
  const effectiveDeliveryOutlet =
    deliveryOutlet === "ALL" || deliveryOutletOptions.includes(deliveryOutlet) ? deliveryOutlet : "ALL";

  const filteredDeliveryOrdersByOutlet = useMemo(() => {
    return deliveryOrders.filter((order) => {
      if (effectiveDeliveryOutlet === "ALL") return true;
      const outletName = order.official_outlets?.name?.trim();
      const value = outletName || order.outlet_id || "未知分店";
      return value === effectiveDeliveryOutlet;
    });
  }, [deliveryOrders, effectiveDeliveryOutlet]);

  const deliveryCategoryOptions = useMemo(() => {
    const categories = new Set<string>();
    for (const order of filteredDeliveryOrdersByOutlet) {
      const rows = itemsByOrderId.get(order.id) ?? [];
      for (const item of rows) {
        if (item.item_type !== "menu_item") continue;
        categories.add(menuItemCategories.get(item.item_id) ?? "未分类");
      }
    }
    return Array.from(categories).sort((a, b) => a.localeCompare(b, "zh"));
  }, [filteredDeliveryOrdersByOutlet, itemsByOrderId, menuItemCategories]);
  const effectiveDeliveryCategory =
    deliveryCategory === "ALL" || deliveryCategoryOptions.includes(deliveryCategory) ? deliveryCategory : "ALL";

  const deliveryOrderIdsByCategory = useMemo(() => {
    if (effectiveDeliveryCategory === "ALL") return null;
    const ids = new Set<string>();
    for (const order of filteredDeliveryOrdersByOutlet) {
      const rows = itemsByOrderId.get(order.id) ?? [];
      const hasCategory = rows.some(
        (item) => item.item_type === "menu_item" && (menuItemCategories.get(item.item_id) ?? "未分类") === effectiveDeliveryCategory,
      );
      if (hasCategory) ids.add(order.id);
    }
    return ids;
  }, [effectiveDeliveryCategory, filteredDeliveryOrdersByOutlet, itemsByOrderId, menuItemCategories]);

  const filteredDeliveryOrders = useMemo(() => {
    if (!deliveryOrderIdsByCategory) return filteredDeliveryOrdersByOutlet;
    return filteredDeliveryOrdersByOutlet.filter((order) => deliveryOrderIdsByCategory.has(order.id));
  }, [deliveryOrderIdsByCategory, filteredDeliveryOrdersByOutlet]);

  const deliveryRevenue = useMemo(() => filteredDeliveryOrders.reduce((sum, row) => sum + toNumber(row.total), 0), [filteredDeliveryOrders]);

  const deliveryItemSales = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of filteredDeliveryOrders) {
      const rows = itemsByOrderId.get(order.id) ?? [];
      for (const item of rows) {
        if (item.item_type !== "menu_item") continue;
        const categoryName = menuItemCategories.get(item.item_id) ?? "未分类";
        if (effectiveDeliveryCategory !== "ALL" && categoryName !== effectiveDeliveryCategory) continue;
        const label = item.title?.trim() || item.item_id.slice(0, 8);
        map.set(label, (map.get(label) ?? 0) + toNumber(item.quantity));
      }
    }
    return Array.from(map.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [effectiveDeliveryCategory, filteredDeliveryOrders, itemsByOrderId, menuItemCategories]);

  const deliveryCategorySales = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of filteredDeliveryOrders) {
      const rows = itemsByOrderId.get(order.id) ?? [];
      for (const item of rows) {
        if (item.item_type !== "menu_item") continue;
        const categoryName = menuItemCategories.get(item.item_id) ?? "未分类";
        if (effectiveDeliveryCategory !== "ALL" && categoryName !== effectiveDeliveryCategory) continue;
        map.set(categoryName, (map.get(categoryName) ?? 0) + toNumber(item.quantity));
      }
    }
    return Array.from(map.entries())
      .map(([category, quantity]) => ({ category, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [effectiveDeliveryCategory, filteredDeliveryOrders, itemsByOrderId, menuItemCategories]);

  const deliveryDetailRows = useMemo(() => {
    return filteredDeliveryOrders.map((order) => {
      const rows = itemsByOrderId.get(order.id) ?? [];
      const menuItems = rows.filter((x) => x.item_type === "menu_item");
      const selectedMenuItems =
        effectiveDeliveryCategory === "ALL"
          ? menuItems
          : menuItems.filter((item) => (menuItemCategories.get(item.item_id) ?? "未分类") === effectiveDeliveryCategory);
      const soldPieces = selectedMenuItems.reduce((sum, item) => sum + toNumber(item.quantity), 0);
      const outletName = order.official_outlets?.name?.trim() || order.outlet_id || "未知分店";
      return {
        id: order.id,
        orderId: order.id.slice(0, 8).toUpperCase(),
        createdAt: new Date(order.created_at).toLocaleString("zh-CN", { hour12: false }),
        outlet: outletName,
        revenue: toNumber(order.total),
        soldPieces,
      };
    });
  }, [effectiveDeliveryCategory, filteredDeliveryOrders, itemsByOrderId, menuItemCategories]);

  const userBehaviorRows = useMemo(() => {
    const onlineOrdersByUser = new Map<string, ReportOrderRow[]>();
    for (const order of orders) {
      if (!order.user_id) continue;
      const rows = onlineOrdersByUser.get(order.user_id) ?? [];
      rows.push(order);
      onlineOrdersByUser.set(order.user_id, rows);
    }
    const dineInByUser = new Map<string, ReportDineInAccrualRow[]>();
    for (const row of dineInAccruals) {
      const rows = dineInByUser.get(row.member_user_id) ?? [];
      rows.push(row);
      dineInByUser.set(row.member_user_id, rows);
    }
    const result = userProfiles.map((profile) => {
      const onlineRows = onlineOrdersByUser.get(profile.id) ?? [];
      const dineInRows = dineInByUser.get(profile.id) ?? [];
      const dineInApproved = dineInRows.filter((row) => row.status === "approved");
      const onlineSpend = onlineRows.reduce((sum, row) => sum + toNumber(row.total), 0);
      const dineInSpend = dineInApproved.reduce((sum, row) => sum + toNumber(row.spend_amount), 0);
      const shopOrderCount = onlineRows.filter((row) => row.channel === "shop").length;
      const deliveryOrderCount = onlineRows.filter((row) => row.channel === "delivery").length;
      const outletCounter = new Map<string, number>();
      for (const row of dineInRows) {
        const outletName = row.official_outlets?.name?.trim() || "未知门店";
        outletCounter.set(outletName, (outletCounter.get(outletName) ?? 0) + 1);
      }
      const topOutlet = Array.from(outletCounter.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
      const lastOnlineAt = onlineRows[0]?.created_at ?? null;
      const lastDineInAt = dineInRows[0]?.submitted_at ?? null;
      const lastActiveAt = [lastOnlineAt, lastDineInAt].filter(Boolean).sort().reverse()[0] ?? null;
      return {
        userId: profile.id,
        fullName: profile.full_name?.trim() || "未命名会员",
        phone: profile.phone?.trim() || "-",
        tier: profile.membership_tier,
        shopOrderCount,
        deliveryOrderCount,
        onlineOrderCount: onlineRows.length,
        dineInScanCount: dineInRows.length,
        dineInApprovedCount: dineInApproved.length,
        onlineSpend,
        dineInSpend,
        totalSpend: onlineSpend + dineInSpend,
        topOutlet,
        lastActiveAt,
      };
    });
    return result;
  }, [dineInAccruals, orders, userProfiles]);

  const filteredUserBehaviorRows = useMemo(() => {
    const keyword = userKeyword.trim().toLowerCase();
    return userBehaviorRows
      .filter((row) => (userTierFilter === "ALL" ? true : row.tier === userTierFilter))
      .filter((row) => {
        if (!keyword) return true;
        const bucket = `${row.fullName} ${row.phone} ${row.userId}`.toLowerCase();
        return bucket.includes(keyword);
      });
  }, [userBehaviorRows, userKeyword, userTierFilter]);

  const visibleSelectedShopOrderIds = useMemo(() => {
    const visibleIds = new Set(shopDetailRows.map((row) => row.id));
    return selectedShopOrderIds.filter((id) => visibleIds.has(id));
  }, [selectedShopOrderIds, shopDetailRows]);
  const visibleSelectedDeliveryOrderIds = useMemo(() => {
    const visibleIds = new Set(deliveryDetailRows.map((row) => row.id));
    return selectedDeliveryOrderIds.filter((id) => visibleIds.has(id));
  }, [deliveryDetailRows, selectedDeliveryOrderIds]);
  const visibleSelectedUserIds = useMemo(() => {
    const visibleIds = new Set(filteredUserBehaviorRows.map((row) => row.userId));
    return selectedUserIds.filter((id) => visibleIds.has(id));
  }, [filteredUserBehaviorRows, selectedUserIds]);

  const shopAllSelected = shopDetailRows.length > 0 && visibleSelectedShopOrderIds.length === shopDetailRows.length;
  const deliveryAllSelected = deliveryDetailRows.length > 0 && visibleSelectedDeliveryOrderIds.length === deliveryDetailRows.length;
  const userAllSelected = filteredUserBehaviorRows.length > 0 && visibleSelectedUserIds.length === filteredUserBehaviorRows.length;
  const selectedShopDetailRow = shopDetailRows.find((row) => row.id === shopDetailModalOrderId) ?? null;
  const selectedDeliveryDetailRow = deliveryDetailRows.find((row) => row.id === deliveryDetailModalOrderId) ?? null;
  const selectedShopOrder = shopDetailModalOrderId ? orderById.get(shopDetailModalOrderId) ?? null : null;
  const selectedDeliveryOrder = deliveryDetailModalOrderId ? orderById.get(deliveryDetailModalOrderId) ?? null : null;
  const selectedShopItems = shopDetailModalOrderId ? itemsByOrderId.get(shopDetailModalOrderId) ?? [] : [];
  const selectedDeliveryItems = deliveryDetailModalOrderId ? itemsByOrderId.get(deliveryDetailModalOrderId) ?? [] : [];

  const activeUserCount = useMemo(
    () => filteredUserBehaviorRows.filter((row) => row.onlineOrderCount > 0 || row.dineInScanCount > 0).length,
    [filteredUserBehaviorRows],
  );
  const totalUserSpend = useMemo(
    () => filteredUserBehaviorRows.reduce((sum, row) => sum + row.totalSpend, 0),
    [filteredUserBehaviorRows],
  );
  const totalDineInScans = useMemo(
    () => filteredUserBehaviorRows.reduce((sum, row) => sum + row.dineInScanCount, 0),
    [filteredUserBehaviorRows],
  );
  const userTopSpenders = useMemo(
    () => [...filteredUserBehaviorRows].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10),
    [filteredUserBehaviorRows],
  );
  const outletVisitStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of dineInAccruals) {
      const outletName = row.official_outlets?.name?.trim() || "未知门店";
      map.set(outletName, (map.get(outletName) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([outlet, scans]) => ({ outlet, scans }))
      .sort((a, b) => b.scans - a.scans);
  }, [dineInAccruals]);

  const userTierDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filteredUserBehaviorRows) {
      map.set(row.tier, (map.get(row.tier) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([tier, users]) => ({ tier, users }))
      .sort((a, b) => b.users - a.users);
  }, [filteredUserBehaviorRows]);

  const channelPreferenceStats = useMemo(() => {
    let shopUsers = 0;
    let deliveryUsers = 0;
    let dineInUsers = 0;
    for (const row of filteredUserBehaviorRows) {
      if (row.shopOrderCount > 0) shopUsers += 1;
      if (row.deliveryOrderCount > 0) deliveryUsers += 1;
      if (row.dineInScanCount > 0) dineInUsers += 1;
    }
    return { shopUsers, deliveryUsers, dineInUsers };
  }, [filteredUserBehaviorRows]);

  const userSegments = useMemo(() => {
    const now = userSegmentsSnapshotTime;
    let newUsers = 0;
    let dormantUsers = 0;
    let highEngagementUsers = 0;
    for (const row of filteredUserBehaviorRows) {
      const profile = userProfiles.find((profileRow) => profileRow.id === row.userId);
      if (profile) {
        const createdDays = Math.floor((now - new Date(profile.created_at).getTime()) / 86400000);
        if (createdDays <= 30) newUsers += 1;
      }
      if (row.lastActiveAt) {
        const inactiveDays = Math.floor((now - new Date(row.lastActiveAt).getTime()) / 86400000);
        if (inactiveDays > 60) dormantUsers += 1;
      } else {
        dormantUsers += 1;
      }
      if (row.onlineOrderCount + row.dineInScanCount >= 5) highEngagementUsers += 1;
    }
    return { newUsers, dormantUsers, highEngagementUsers };
  }, [filteredUserBehaviorRows, userProfiles, userSegmentsSnapshotTime]);

  const selectedUserDetailRow = useMemo(
    () =>
      userDetailModalUserId
        ? filteredUserBehaviorRows.find((item) => item.userId === userDetailModalUserId) ??
          userBehaviorRows.find((item) => item.userId === userDetailModalUserId) ??
          null
        : null,
    [filteredUserBehaviorRows, userBehaviorRows, userDetailModalUserId],
  );

  const userDetailOrders = useMemo(() => {
    if (!userDetailModalUserId) return [];
    return orders
      .filter((row) => row.user_id === userDetailModalUserId)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [orders, userDetailModalUserId]);

  const userDetailDineInRows = useMemo(() => {
    if (!userDetailModalUserId) return [];
    return dineInAccruals
      .filter((row) => row.member_user_id === userDetailModalUserId)
      .sort((a, b) => +new Date(b.submitted_at) - +new Date(a.submitted_at));
  }, [dineInAccruals, userDetailModalUserId]);

  const USER_DETAIL_PAGE_SIZE = 10;
  const userDetailOrderPageCount = Math.max(1, Math.ceil(userDetailOrders.length / USER_DETAIL_PAGE_SIZE));
  const userDetailDineInPageCount = Math.max(1, Math.ceil(userDetailDineInRows.length / USER_DETAIL_PAGE_SIZE));
  const userDetailPointsPageCount = Math.max(1, Math.ceil(userDetailPointsRows.length / USER_DETAIL_PAGE_SIZE));
  const userDetailOrdersPageRows = userDetailOrders.slice((userDetailOrderPage - 1) * USER_DETAIL_PAGE_SIZE, userDetailOrderPage * USER_DETAIL_PAGE_SIZE);
  const userDetailDineInPageRows = userDetailDineInRows.slice((userDetailDineInPage - 1) * USER_DETAIL_PAGE_SIZE, userDetailDineInPage * USER_DETAIL_PAGE_SIZE);
  const userDetailPointsPageRows = userDetailPointsRows.slice((userDetailPointsPage - 1) * USER_DETAIL_PAGE_SIZE, userDetailPointsPage * USER_DETAIL_PAGE_SIZE);

  const shopAverageOrderValue = filteredShopOrders.length > 0 ? shopRevenue / filteredShopOrders.length : 0;
  const shopAveragePackageCount = filteredShopOrders.length > 0 ? shopPackageCount / filteredShopOrders.length : 0;
  const shopMemberOrders = useMemo(() => filteredShopOrders.filter((row) => Boolean(row.user_id)), [filteredShopOrders]);
  const shopNewBuyerMetrics = useMemo(() => {
    const orderCountByUser = new Map<string, number>();
    for (const row of shopMemberOrders) {
      if (!row.user_id) continue;
      orderCountByUser.set(row.user_id, (orderCountByUser.get(row.user_id) ?? 0) + 1);
    }
    let newBuyerOrders = 0;
    let repeatBuyerOrders = 0;
    let repeatBuyerMembers = 0;
    for (const [, count] of orderCountByUser.entries()) {
      if (count >= 2) repeatBuyerMembers += 1;
      if (count === 1) newBuyerOrders += 1;
      if (count >= 2) repeatBuyerOrders += count;
    }
    const denominator = Math.max(shopMemberOrders.length, 1);
    return {
      newBuyerOrders,
      repeatBuyerOrders,
      repeatBuyerMembers,
      newBuyerOrderRatio: (newBuyerOrders / denominator) * 100,
      repeatBuyerOrderRatio: (repeatBuyerOrders / denominator) * 100,
    };
  }, [shopMemberOrders]);
  const shopOverview = overviewSummary?.shop ?? null;
  const shopDashboardRevenue = Number(shopOverview?.revenue ?? shopRevenue);
  const shopDashboardOrderCount = Number(shopOverview?.order_count ?? filteredShopOrders.length);
  const shopDashboardAverageOrderValue = Number(shopOverview?.average_order_value ?? shopAverageOrderValue);
  const shopDashboardNewBuyerOrders = Number(shopOverview?.new_buyer_orders ?? shopNewBuyerMetrics.newBuyerOrders);
  const shopDashboardRepeatBuyerOrders = Number(shopOverview?.repeat_buyer_orders ?? shopNewBuyerMetrics.repeatBuyerOrders);
  const shopDashboardRepeatBuyerMembers = Number(shopOverview?.repeat_buyer_members ?? shopNewBuyerMetrics.repeatBuyerMembers);
  const shopDashboardNewBuyerRatio = shopDashboardOrderCount > 0 ? (shopDashboardNewBuyerOrders / shopDashboardOrderCount) * 100 : 0;
  const shopDashboardRepeatBuyerRatio = shopDashboardOrderCount > 0 ? (shopDashboardRepeatBuyerOrders / shopDashboardOrderCount) * 100 : 0;
  const shopRevenueTrend = buildSeriesByGranularity(filteredShopOrders, (row) => row.created_at, (row) => toNumber(row.total), trendGranularity);
  const shopCurrencyMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filteredShopOrders) {
      map.set(row.currency, (map.get(row.currency) ?? 0) + toNumber(row.total));
    }
    return Array.from(map.entries()).map(([label, value], index) => ({
      label,
      value,
      color: index === 0 ? "#ef7c30" : "#0f766e",
    }));
  }, [filteredShopOrders]);
  const shopTopProducts = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of filteredShopOrders) {
      for (const item of itemsByOrderId.get(order.id) ?? []) {
        const label = item.title?.trim() || item.item_id.slice(0, 8);
        map.set(label, (map.get(label) ?? 0) + toNumber(item.quantity));
      }
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredShopOrders, itemsByOrderId]);

  const deliveryAverageOrderValue = filteredDeliveryOrders.length > 0 ? deliveryRevenue / filteredDeliveryOrders.length : 0;
  const deliveryAveragePieces = filteredDeliveryOrders.length > 0
    ? deliveryItemSales.reduce((sum, row) => sum + row.quantity, 0) / filteredDeliveryOrders.length
    : 0;
  const deliveryOutletPerformance = useMemo(() => {
    const revenueMap = new Map<string, number>();
    const orderMap = new Map<string, number>();
    for (const row of filteredDeliveryOrders) {
      const label = row.official_outlets?.name?.trim() || row.outlet_id || "未知分店";
      revenueMap.set(label, (revenueMap.get(label) ?? 0) + toNumber(row.total));
      orderMap.set(label, (orderMap.get(label) ?? 0) + 1);
    }
    return Array.from(revenueMap.entries())
      .map(([label, value]) => ({
        label,
        value,
        note: `${orderMap.get(label) ?? 0} 单`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredDeliveryOrders]);
  const deliveryRevenueTrend = buildSeriesByGranularity(filteredDeliveryOrders, (row) => row.created_at, (row) => toNumber(row.total), trendGranularity);
  const deliveryCategoryMix = useMemo(
    () =>
      deliveryCategorySales.slice(0, 5).map((row, index) => ({
        label: row.category,
        value: row.quantity,
        color: ["#ef7c30", "#f59e0b", "#0f766e", "#334155", "#7c3aed"][index % 5],
      })),
    [deliveryCategorySales],
  );
  const deliveryDaypartMix = useMemo(() => {
    const buckets = new Map<string, number>([
      ["午餐前", 0],
      ["午餐", 0],
      ["下午", 0],
      ["晚餐", 0],
      ["深夜", 0],
    ]);
    for (const row of filteredDeliveryOrders) {
      const hour = new Date(row.created_at).getHours();
      const key =
        hour < 11 ? "午餐前" : hour < 15 ? "午餐" : hour < 18 ? "下午" : hour < 22 ? "晚餐" : "深夜";
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).map(([label, value], index) => ({
      label,
      value,
      color: ["#ef7c30", "#f59e0b", "#0f766e", "#1d4ed8", "#64748b"][index % 5],
    }));
  }, [filteredDeliveryOrders]);
  const deliveryOverview = overviewSummary?.delivery ?? null;
  const deliveryDashboardRevenue = Number(deliveryOverview?.revenue ?? deliveryRevenue);
  const deliveryDashboardOrderCount = Number(deliveryOverview?.order_count ?? filteredDeliveryOrders.length);
  const deliveryDashboardAverageOrderValue = Number(deliveryOverview?.average_order_value ?? deliveryAverageOrderValue);
  const deliveryDashboardSoldPieces = Number(deliveryOverview?.sold_pieces ?? deliveryItemSales.reduce((sum, row) => sum + row.quantity, 0));
  const deliveryDashboardAveragePieces = Number(deliveryOverview?.average_pieces ?? deliveryAveragePieces);

  const userOnlineSpendTotal = useMemo(
    () => filteredUserBehaviorRows.reduce((sum, row) => sum + row.onlineSpend, 0),
    [filteredUserBehaviorRows],
  );
  const userDineInSpendTotal = useMemo(
    () => filteredUserBehaviorRows.reduce((sum, row) => sum + row.dineInSpend, 0),
    [filteredUserBehaviorRows],
  );
  const userSpendMix = useMemo(
    () => [
      { label: "线上消费", value: userOnlineSpendTotal, color: "#ef7c30" },
      { label: "门店消费", value: userDineInSpendTotal, color: "#0f766e" },
    ],
    [userDineInSpendTotal, userOnlineSpendTotal],
  );
  const repeatMemberCount = useMemo(
    () => filteredUserBehaviorRows.filter((row) => row.onlineOrderCount + row.dineInApprovedCount >= 2).length,
    [filteredUserBehaviorRows],
  );
  const memberOverview = overviewSummary?.member ?? null;
  const memberDashboardActiveCount = Number(memberOverview?.active_member_count ?? activeUserCount);
  const memberDashboardTotalSpend = Number(memberOverview?.total_spend ?? totalUserSpend);
  const memberDashboardScanCount = Number(memberOverview?.dine_in_scans ?? totalDineInScans);
  const memberDashboardRepeatMembers = Number(memberOverview?.repeat_members ?? repeatMemberCount);
  const memberDashboardAvgSpend = memberDashboardActiveCount > 0 ? memberDashboardTotalSpend / memberDashboardActiveCount : 0;
  const recentlyReturnedMemberCount = useMemo(() => {
    const now = new Date(`${rangeEnd}T23:59:59.999`).getTime();
    let count = 0;
    for (const row of filteredUserBehaviorRows) {
      const activityDates: number[] = [];
      for (const order of orders) {
        if (order.user_id === row.userId) activityDates.push(new Date(order.created_at).getTime());
      }
      for (const dineIn of dineInAccruals) {
        if (dineIn.member_user_id === row.userId) activityDates.push(new Date(dineIn.submitted_at).getTime());
      }
      activityDates.sort((a, b) => a - b);
      if (activityDates.length < 2) continue;
      const latest = activityDates[activityDates.length - 1];
      const previous = activityDates[activityDates.length - 2];
      const gapDays = (latest - previous) / 86400000;
      const latestDaysFromEnd = (now - latest) / 86400000;
      if (gapDays >= 30 && latestDaysFromEnd <= 30) count += 1;
    }
    return count;
  }, [dineInAccruals, filteredUserBehaviorRows, orders, rangeEnd]);
  const upgradedTierMemberCount = useMemo(
    () => filteredUserBehaviorRows.filter((row) => row.tier !== "none").length,
    [filteredUserBehaviorRows],
  );
  const userActivityTrend = buildUniqueMemberSeries(
    [
      ...orders
        .filter((order) => Boolean(order.user_id))
        .map((order) => ({ memberId: String(order.user_id), eventAt: order.created_at })),
      ...dineInAccruals.map((row) => ({ memberId: row.member_user_id, eventAt: row.submitted_at })),
    ],
    trendGranularity,
  );
  const userTierSlices = useMemo(
    () =>
      userTierDistribution.map((row, index) => ({
        label: row.tier,
        value: row.users,
        color: ["#94a3b8", "#ef7c30", "#0f766e", "#f59e0b"][index % 4],
      })),
    [userTierDistribution],
  );
  const useRpcShopDashboard = shopCurrency === "ALL" && effectiveShopRegion === "ALL";
  const useRpcDeliveryDashboard = effectiveDeliveryOutlet === "ALL" && effectiveDeliveryCategory === "ALL";
  const useRpcMemberDashboard = userTierFilter === "ALL" && userKeyword.trim() === "";
  const shopTrendData = useRpcShopDashboard ? coerceDashboardData(dashboardSummary?.shop?.trend) : shopRevenueTrend;
  const shopCurrencyMixData = useRpcShopDashboard
    ? coerceDashboardData(dashboardSummary?.shop?.currency_mix).map((row, index) => ({
        label: row.label,
        value: row.value,
        color: index === 0 ? "#ef7c30" : "#0f766e",
      }))
    : shopCurrencyMix;
  const shopRegionSalesData = useRpcShopDashboard
    ? coerceDashboardData(dashboardSummary?.shop?.region_sales)
    : shopRegionSales.map((row) => ({ label: row.region, value: row.revenue }));
  const shopTopProductsData = useRpcShopDashboard ? coerceDashboardData(dashboardSummary?.shop?.top_products) : shopTopProducts;
  const deliveryTrendData = useRpcDeliveryDashboard ? coerceDashboardData(dashboardSummary?.delivery?.trend) : deliveryRevenueTrend;
  const deliveryDaypartMixData = useRpcDeliveryDashboard
    ? coerceDashboardData(dashboardSummary?.delivery?.daypart_mix).map((row, index) => ({
        label: row.label,
        value: row.value,
        color: ["#ef7c30", "#f59e0b", "#0f766e", "#1d4ed8", "#64748b"][index % 5],
      }))
    : deliveryDaypartMix;
  const deliveryOutletPerformanceData = useRpcDeliveryDashboard
    ? coerceDashboardData(dashboardSummary?.delivery?.outlet_performance)
    : deliveryOutletPerformance;
  const deliveryCategoryMixData = useRpcDeliveryDashboard
    ? coerceDashboardData(dashboardSummary?.delivery?.category_mix).map((row, index) => ({
        label: row.label,
        value: row.value,
        color: ["#ef7c30", "#f59e0b", "#0f766e", "#334155", "#7c3aed"][index % 5],
      }))
    : deliveryCategoryMix;
  const memberActivityTrendData = useRpcMemberDashboard ? coerceDashboardData(dashboardSummary?.member?.activity_trend) : userActivityTrend;
  const memberSpendMixData = useRpcMemberDashboard
    ? coerceDashboardData(dashboardSummary?.member?.spend_mix).map((row, index) => ({
        label: row.label,
        value: row.value,
        color: ["#ef7c30", "#0f766e"][index % 2],
      }))
    : userSpendMix;
  const memberTopSpendersData = useRpcMemberDashboard
    ? coerceDashboardData(dashboardSummary?.member?.top_spenders)
    : userTopSpenders.map((row) => ({ label: row.fullName, value: row.totalSpend, note: row.phone }));
  const memberTierSlicesData = useRpcMemberDashboard
    ? coerceDashboardData(dashboardSummary?.member?.tier_distribution).map((row, index) => ({
        label: row.label,
        value: row.value,
        color: ["#94a3b8", "#ef7c30", "#0f766e", "#f59e0b"][index % 4],
      }))
    : userTierSlices;
  const memberChannelPreferenceData = useRpcMemberDashboard
    ? coerceDashboardData(dashboardSummary?.member?.channel_preference)
    : [
        { label: "商城", value: channelPreferenceStats.shopUsers },
        { label: "外卖", value: channelPreferenceStats.deliveryUsers },
        { label: "门店扫码", value: channelPreferenceStats.dineInUsers },
      ];
  const memberOutletVisitsData = useRpcMemberDashboard
    ? coerceDashboardData(dashboardSummary?.member?.outlet_visits)
    : outletVisitStats.map((row) => ({ label: row.outlet, value: row.scans }));

  const openUserDetailModal = (userId: string) => {
    setUserDetailOrderPage(1);
    setUserDetailDineInPage(1);
    setUserDetailPointsPage(1);
    setUserDetailPointsRows([]);
    setUserDetailLoading(false);
    setUserDetailModalUserId(userId);
  };

  const closeUserDetailModal = () => {
    setUserDetailModalUserId(null);
    setUserDetailPointsRows([]);
    setUserDetailLoading(false);
    setUserDetailOrderPage(1);
    setUserDetailDineInPage(1);
    setUserDetailPointsPage(1);
  };

  useEffect(() => {
    const db = supabase;
    if (!db || !userDetailModalUserId) return;
    let active = true;
    const run = async () => {
      setUserDetailLoading(true);
      const res = await db
        .from("official_points_ledger")
        .select("id,channel,points_delta,reason,source_type,source_id,created_at")
        .eq("user_id", userDetailModalUserId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      setUserDetailPointsRows((res.data ?? []) as ReportPointsLedgerRow[]);
      setUserDetailLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, [userDetailModalUserId]);

  const exportShopCsv = () => {
    const selected = shopDetailRows.filter((row) => visibleSelectedShopOrderIds.includes(row.id));
    if (selected.length === 0) return;
    const lines = [
      ["订单号", "下单时间", "币种", "销售额", "区域", "售出包数"].map(csvEscape).join(","),
      ...selected.map((row) =>
        [row.orderId, row.createdAt, row.currency, row.revenue.toFixed(2), row.region, row.packages].map(csvEscape).join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shop-report-${rangeStart}-${rangeEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportDeliveryCsv = () => {
    const selected = deliveryDetailRows.filter((row) => visibleSelectedDeliveryOrderIds.includes(row.id));
    if (selected.length === 0) return;
    const lines = [
      ["订单号", "下单时间", "分店", "销售额", "单品销量"].map(csvEscape).join(","),
      ...selected.map((row) =>
        [row.orderId, row.createdAt, row.outlet, row.revenue.toFixed(2), row.soldPieces].map(csvEscape).join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `delivery-report-${rangeStart}-${rangeEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportUserCsv = () => {
    const selected = filteredUserBehaviorRows.filter((row) => visibleSelectedUserIds.includes(row.userId));
    if (selected.length === 0) return;
    const lines = [
      ["会员ID", "姓名", "手机号", "等级", "商城单", "外卖单", "门店扫码", "线上消费", "门店消费", "总消费", "偏好门店", "最近活跃"].map(csvEscape).join(","),
      ...selected.map((row) =>
        [
          row.userId,
          row.fullName,
          row.phone,
          row.tier,
          row.shopOrderCount,
          row.deliveryOrderCount,
          row.dineInScanCount,
          row.onlineSpend.toFixed(2),
          row.dineInSpend.toFixed(2),
          row.totalSpend.toFixed(2),
          row.topOutlet,
          row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleString("zh-CN", { hour12: false }) : "-",
        ]
          .map(csvEscape)
          .join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `member-behavior-report-${rangeStart}-${rangeEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSingleUserCsv = () => {
    if (!selectedUserDetailRow || !userDetailModalUserId) return;
    const lines: string[] = [];
    lines.push(["会员ID", "姓名", "手机号", "等级", "总消费", "最近活跃"].map(csvEscape).join(","));
    lines.push(
      [
        selectedUserDetailRow.userId,
        selectedUserDetailRow.fullName,
        selectedUserDetailRow.phone,
        selectedUserDetailRow.tier,
        selectedUserDetailRow.totalSpend.toFixed(2),
        selectedUserDetailRow.lastActiveAt ? new Date(selectedUserDetailRow.lastActiveAt).toLocaleString("zh-CN", { hour12: false }) : "-",
      ]
        .map(csvEscape)
        .join(","),
    );
    lines.push("");
    lines.push(["线上订单时间", "渠道", "状态", "金额", "分店"].map(csvEscape).join(","));
    for (const order of userDetailOrders) {
      lines.push(
        [
          new Date(order.created_at).toLocaleString("zh-CN", { hour12: false }),
          order.channel === "shop" ? "商城" : "外卖",
          order.status || "-",
          toNumber(order.total).toFixed(2),
          order.official_outlets?.name?.trim() || "-",
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    lines.push("");
    lines.push(["扫码时间", "门店", "状态", "消费金额"].map(csvEscape).join(","));
    for (const row of userDetailDineInRows) {
      lines.push(
        [
          new Date(row.submitted_at).toLocaleString("zh-CN", { hour12: false }),
          row.official_outlets?.name?.trim() || "未知门店",
          row.status,
          toNumber(row.spend_amount).toFixed(2),
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    lines.push("");
    lines.push(["积分时间", "类型", "渠道", "积分变化", "来源类型", "来源ID"].map(csvEscape).join(","));
    for (const row of userDetailPointsRows) {
      lines.push(
        [
          new Date(row.created_at).toLocaleString("zh-CN", { hour12: false }),
          row.reason,
          row.channel,
          toNumber(row.points_delta).toFixed(2),
          row.source_type,
          row.source_id,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `member-detail-${selectedUserDetailRow.userId}-${rangeStart}-${rangeEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const statementMetaRows = (channelLabel: string, filters: Array<{ 项目: string; 值: string | number }>) => [
    { 项目: "报表名称", 值: `${channelLabel} Statement` },
    { 项目: "导出时间", 值: exportedAt },
    { 项目: "统计周期开始", 值: rangeStart },
    { 项目: "统计周期结束", 值: rangeEnd },
    { 项目: "趋势粒度", 值: granularityLabel },
    ...filters,
  ];

  const downloadWorkbook = (fileName: string, sheets: Array<{ name: string; rows: Array<Record<string, string | number>> }>) => {
    const workbook = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
    }
    XLSX.writeFile(workbook, fileName);
  };

  const exportShopStatement = () => {
    downloadWorkbook(`shop-statement-${rangeStart}-${rangeEnd}.xlsx`, [
      {
        name: "Cover",
        rows: statementMetaRows("商城", [
          { 项目: "币种筛选", 值: shopCurrency === "ALL" ? "全部" : shopCurrency },
          { 项目: "区域筛选", 值: shopRegion === "ALL" ? "全部" : shopRegion },
        ]),
      },
      {
        name: "Summary",
        rows: [
          { 指标: "订单数", 数值: shopDashboardOrderCount },
          { 指标: "销售额", 数值: Number(shopDashboardRevenue.toFixed(2)) },
          { 指标: "平均客单价", 数值: Number(shopDashboardAverageOrderValue.toFixed(2)) },
          { 指标: "售出包数", 数值: shopPackageCount },
          { 指标: "平均每单包数", 数值: Number(shopAveragePackageCount.toFixed(2)) },
          { 指标: "新客订单占比", 数值: `${shopDashboardNewBuyerRatio.toFixed(1)}%` },
          { 指标: "复购订单占比", 数值: `${shopDashboardRepeatBuyerRatio.toFixed(1)}%` },
        ],
      },
      {
        name: "Trend",
        rows: shopTrendData.map((row) => ({ 周期: row.label, 排序键: row.sortKey ?? row.label, 销售额: Number(row.value.toFixed(2)) })),
      },
      {
        name: "Region Mix",
        rows: shopRegionSalesData.map((row) => ({ 区域: row.label, 销售额: Number(row.value.toFixed(2)) })),
      },
      {
        name: "Orders",
        rows: shopDetailRows.map((row) => ({
          订单号: row.orderId,
          下单时间: row.createdAt,
          币种: row.currency,
          销售额: Number(row.revenue.toFixed(2)),
          区域: row.region,
          售出包数: row.packages,
        })),
      },
    ]);
  };

  const exportDeliveryStatement = () => {
    downloadWorkbook(`delivery-statement-${rangeStart}-${rangeEnd}.xlsx`, [
      {
        name: "Cover",
        rows: statementMetaRows("外卖", [
          { 项目: "分店筛选", 值: deliveryOutlet === "ALL" ? "全部" : deliveryOutlet },
          { 项目: "分类筛选", 值: deliveryCategory === "ALL" ? "全部" : deliveryCategory },
        ]),
      },
      {
        name: "Summary",
        rows: [
          { 指标: "订单数", 数值: deliveryDashboardOrderCount },
          { 指标: "销售额", 数值: Number(deliveryDashboardRevenue.toFixed(2)) },
          { 指标: "平均客单价", 数值: Number(deliveryDashboardAverageOrderValue.toFixed(2)) },
          { 指标: "平均每单件数", 数值: Number(deliveryDashboardAveragePieces.toFixed(2)) },
        ],
      },
      {
        name: "Trend",
        rows: deliveryTrendData.map((row) => ({ 周期: row.label, 排序键: row.sortKey ?? row.label, 销售额: Number(row.value.toFixed(2)) })),
      },
      {
        name: "Outlet Mix",
        rows: deliveryOutletPerformanceData.map((row) => ({ 分店: row.label, 销售额: Number(row.value.toFixed(2)), 订单数说明: row.note ?? "-" })),
      },
      {
        name: "Orders",
        rows: deliveryDetailRows.map((row) => ({
          订单号: row.orderId,
          下单时间: row.createdAt,
          分店: row.outlet,
          销售额: Number(row.revenue.toFixed(2)),
          单品销量: row.soldPieces,
        })),
      },
    ]);
  };

  const exportUserStatement = () => {
    downloadWorkbook(`member-statement-${rangeStart}-${rangeEnd}.xlsx`, [
      {
        name: "Cover",
        rows: statementMetaRows("会员", [
          { 项目: "会员等级筛选", 值: userTierFilter === "ALL" ? "全部" : userTierFilter },
          { 项目: "关键词筛选", 值: userKeyword.trim() || "无" },
        ]),
      },
      {
        name: "Summary",
        rows: [
          { 指标: "活跃会员", 数值: memberDashboardActiveCount },
          { 指标: "总消费额", 数值: Number(memberDashboardTotalSpend.toFixed(2)) },
          { 指标: "人均消费", 数值: Number(memberDashboardAvgSpend.toFixed(2)) },
          { 指标: "门店扫码次数", 数值: memberDashboardScanCount },
          { 指标: "复购会员数", 数值: memberDashboardRepeatMembers },
          { 指标: "近30天回流会员", 数值: recentlyReturnedMemberCount },
          { 指标: "已升级等级会员", 数值: upgradedTierMemberCount },
        ],
      },
      {
        name: "Activity Trend",
        rows: memberActivityTrendData.map((row) => ({ 周期: row.label, 排序键: row.sortKey ?? row.label, 活跃会员数: row.value })),
      },
      {
        name: "Tier Mix",
        rows: userTierDistribution.map((row) => ({ 等级: row.tier, 会员数: row.users })),
      },
      {
        name: "Members",
        rows: filteredUserBehaviorRows.map((row) => ({
          会员ID: row.userId,
          姓名: row.fullName,
          手机号: row.phone,
          等级: row.tier,
          商城单: row.shopOrderCount,
          外卖单: row.deliveryOrderCount,
          门店扫码: row.dineInScanCount,
          线上消费: Number(row.onlineSpend.toFixed(2)),
          门店消费: Number(row.dineInSpend.toFixed(2)),
          总消费: Number(row.totalSpend.toFixed(2)),
          偏好门店: row.topOutlet,
        })),
      },
    ]);
  };

  const exportActiveStatement = () => {
    if (activeChannel === "shop") {
      exportShopStatement();
      return;
    }
    if (activeChannel === "delivery") {
      exportDeliveryStatement();
      return;
    }
    exportUserStatement();
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-primary/15 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(239,124,48,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_24%)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">报表中心</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">聚焦商城、外卖、会员三大业务板块，支持可视化看板、明细分析与 Statement 导出。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportActiveStatement}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
            >
              Export Statement
            </button>
            <div className={`rounded-lg px-3 py-2 text-xs font-bold ${loading ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"}`}>
              {loading ? "数据加载中..." : `当前订单 ${orders.length} 条`}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
            开始日期
            <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60" />
          </label>
          <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
            结束日期
            <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60" />
          </label>
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => setActiveChannel("shop")} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${activeChannel === "shop" ? "bg-primary text-white" : "border border-primary/25 text-primary hover:bg-primary/10"}`}>
              商城
            </button>
            <button type="button" onClick={() => setActiveChannel("delivery")} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${activeChannel === "delivery" ? "bg-primary text-white" : "border border-primary/25 text-primary hover:bg-primary/10"}`}>
              外卖
            </button>
            <button type="button" onClick={() => setActiveChannel("member")} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${activeChannel === "member" ? "bg-primary text-white" : "border border-primary/25 text-primary hover:bg-primary/10"}`}>
              会员
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          {activeChannel === "shop" ? (
            <>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                币种
                <select value={shopCurrency} onChange={(event) => setShopCurrency(event.target.value as "ALL" | "MYR" | "SGD")} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                  <option value="ALL">全部币种</option>
                  <option value="MYR">MYR</option>
                  <option value="SGD">SGD</option>
                </select>
              </label>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                区域
                <select value={effectiveShopRegion} onChange={(event) => setShopRegion(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                  <option value="ALL">全部区域</option>
                  {shopRegionOptions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button type="button" onClick={() => setShopView("dashboard")} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${shopView === "dashboard" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
                  看板
                </button>
                <button type="button" onClick={() => setShopView("detail")} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${shopView === "detail" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
                  详细报表
                </button>
              </div>
            </>
          ) : activeChannel === "delivery" ? (
            <>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                分店
                <select value={effectiveDeliveryOutlet} onChange={(event) => setDeliveryOutlet(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                  <option value="ALL">全部分店</option>
                  {deliveryOutletOptions.map((outlet) => (
                    <option key={outlet} value={outlet}>
                      {outlet}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                分类
                <select value={effectiveDeliveryCategory} onChange={(event) => setDeliveryCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                  <option value="ALL">全部分类</option>
                  {deliveryCategoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button type="button" onClick={() => setDeliveryView("dashboard")} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${deliveryView === "dashboard" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
                  看板
                </button>
                <button type="button" onClick={() => setDeliveryView("detail")} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${deliveryView === "detail" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
                  详细报表
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                会员等级
                <select value={userTierFilter} onChange={(event) => setUserTierFilter(event.target.value as "ALL" | "none" | "bronze" | "silver" | "gold")} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                  <option value="ALL">全部等级</option>
                  <option value="none">New</option>
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                </select>
              </label>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                会员搜索
                <input
                  value={userKeyword}
                  onChange={(event) => setUserKeyword(event.target.value)}
                  placeholder="姓名 / 手机 / 会员ID"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                />
              </label>
              <div className="flex items-end gap-2">
                <button type="button" onClick={() => setUserView("dashboard")} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${userView === "dashboard" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
                  看板
                </button>
                <button type="button" onClick={() => setUserView("detail")} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${userView === "detail" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
                  详细报表
                </button>
              </div>
            </>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-300">趋势粒度</span>
          {([
            ["day", "按日"],
            ["week", "按周"],
            ["month", "按月"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTrendGranularity(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                trendGranularity === value
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        </div>
      </section>

      {activeChannel === "shop" ? (
        <>
          {shopView === "dashboard" ? (
            <>
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DashboardMetricCard label="商城 GMV" value={formatCurrencyValue(shopDashboardRevenue)} hint="当前筛选周期内商城销售总额" tone="primary" />
                <DashboardMetricCard label="订单数" value={String(shopDashboardOrderCount)} hint="用于观察商城出单体量" />
                <DashboardMetricCard label="平均客单价" value={formatCurrencyValue(shopDashboardAverageOrderValue)} hint="每笔订单平均贡献收入" tone="emerald" />
                <DashboardMetricCard label="平均每单包数" value={shopAveragePackageCount.toFixed(1)} hint={`总售出 ${shopPackageCount} 包`} tone="amber" />
              </section>
              <section className="grid gap-3 md:grid-cols-2">
                <DashboardMetricCard label="新客订单占比" value={`${shopDashboardNewBuyerRatio.toFixed(1)}%`} hint={`新客订单 ${shopDashboardNewBuyerOrders} 笔`} />
                <DashboardMetricCard label="复购订单占比" value={`${shopDashboardRepeatBuyerRatio.toFixed(1)}%`} hint={`复购会员 ${shopDashboardRepeatBuyerMembers} 人`} tone="emerald" />
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <TrendBars title="商城销售趋势" subtitle={`${granularityLabel}聚合销售额，适合看促销或区域筛选后的波动。`} data={shopTrendData} prefix="RM " badge={trendBadge} />
                <DonutBreakdown title="币种占比" subtitle="观察当前筛选条件下的币种收入结构。" slices={shopCurrencyMixData} centerLabel={formatCompactValue(shopDashboardRevenue)} />
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <HorizontalBars title="区域销售排行" subtitle="帮助判断商城订单主要来自哪些区域。" data={shopRegionSalesData} prefix="RM " />
                <HorizontalBars title="商品销量排行" subtitle="查看商城热销商品与组合。" data={shopTopProductsData} suffix=" 件" />
              </section>
            </>
          ) : (
            <UnifiedTable
              title="商城销售详细报表"
              description="每单包含区域、销售额与自动识别包数（Bundle 已折算）。"
              toolbar={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={exportShopStatement}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
                  >
                    导出 Statement
                  </button>
                  <button
                    type="button"
                    onClick={exportShopCsv}
                    disabled={visibleSelectedShopOrderIds.length === 0}
                    className="rounded-lg border border-primary/30 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    导出 CSV（已选 {visibleSelectedShopOrderIds.length}）
                  </button>
                </div>
              }
            >
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={shopAllSelected}
                        onChange={(event) => {
                          if (event.target.checked) setSelectedShopOrderIds(shopDetailRows.map((row) => row.id));
                          else setSelectedShopOrderIds([]);
                        }}
                        className="h-4 w-4 accent-primary"
                      />
                    </th>
                    <th className="px-5 py-3">订单</th>
                    <th className="px-5 py-3">下单时间</th>
                    <th className="px-5 py-3">币种</th>
                    <th className="px-5 py-3">销售额</th>
                    <th className="px-5 py-3">区域</th>
                    <th className="px-5 py-3">售出包数</th>
                  </tr>
                </thead>
                <tbody>
                  {shopDetailRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          checked={selectedShopOrderIds.includes(row.id)}
                          onChange={(event) => {
                            if (event.target.checked) setSelectedShopOrderIds((prev) => [...new Set([...prev, row.id])]);
                            else setSelectedShopOrderIds((prev) => prev.filter((id) => id !== row.id));
                          }}
                          className="h-4 w-4 accent-primary"
                        />
                      </td>
                      <td className="px-5 py-3 font-semibold text-primary">
                        <button type="button" onClick={() => setShopDetailModalOrderId(row.id)} className="font-bold text-primary hover:underline">
                          {row.orderId}
                        </button>
                      </td>
                      <td className="px-5 py-3">{row.createdAt}</td>
                      <td className="px-5 py-3">{row.currency}</td>
                      <td className="px-5 py-3">RM {row.revenue.toFixed(2)}</td>
                      <td className="px-5 py-3">{row.region}</td>
                      <td className="px-5 py-3">{row.packages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </UnifiedTable>
          )}
        </>
      ) : activeChannel === "delivery" ? (
        <>
          {deliveryView === "dashboard" ? (
            <>
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DashboardMetricCard label="外卖 GMV" value={formatCurrencyValue(deliveryDashboardRevenue)} hint="当前筛选周期内外卖销售总额" tone="primary" />
                <DashboardMetricCard label="订单数" value={String(deliveryDashboardOrderCount)} hint="外卖订单总量" />
                <DashboardMetricCard label="平均客单价" value={formatCurrencyValue(deliveryDashboardAverageOrderValue)} hint="单笔外卖订单平均金额" tone="emerald" />
                <DashboardMetricCard label="平均每单件数" value={deliveryDashboardAveragePieces.toFixed(1)} hint={`累计卖出 ${deliveryDashboardSoldPieces} 件`} tone="amber" />
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <TrendBars title="外卖销售趋势" subtitle={`${granularityLabel}聚合外卖收入，用于观察活动、时段与分店波动。`} data={deliveryTrendData} prefix="RM " badge={trendBadge} />
                <DonutBreakdown title="时段分布" subtitle="观察外卖订单集中在哪些营业时段。" slices={deliveryDaypartMixData} centerLabel={String(deliveryDashboardOrderCount)} />
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <HorizontalBars title="分店收入与订单对比" subtitle="同时看各分店收入与单量，便于判断效率和体量。" data={deliveryOutletPerformanceData} prefix="RM " />
                <DonutBreakdown title="分类销量占比" subtitle="聚焦菜单分类结构，适合看品类贡献。" slices={deliveryCategoryMixData} centerLabel={formatCompactValue(deliveryDashboardSoldPieces)} />
              </section>
            </>
          ) : (
            <UnifiedTable
              title="外卖销售详细报表"
              description="按筛选条件展示每单销售额、分店与单品销量。"
              toolbar={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={exportDeliveryStatement}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
                  >
                    导出 Statement
                  </button>
                  <button
                    type="button"
                    onClick={exportDeliveryCsv}
                    disabled={visibleSelectedDeliveryOrderIds.length === 0}
                    className="rounded-lg border border-primary/30 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    导出 CSV（已选 {visibleSelectedDeliveryOrderIds.length}）
                  </button>
                </div>
              }
            >
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={deliveryAllSelected}
                        onChange={(event) => {
                          if (event.target.checked) setSelectedDeliveryOrderIds(deliveryDetailRows.map((row) => row.id));
                          else setSelectedDeliveryOrderIds([]);
                        }}
                        className="h-4 w-4 accent-primary"
                      />
                    </th>
                    <th className="px-5 py-3">订单</th>
                    <th className="px-5 py-3">下单时间</th>
                    <th className="px-5 py-3">分店</th>
                    <th className="px-5 py-3">销售额</th>
                    <th className="px-5 py-3">单品销量</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryDetailRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          checked={selectedDeliveryOrderIds.includes(row.id)}
                          onChange={(event) => {
                            if (event.target.checked) setSelectedDeliveryOrderIds((prev) => [...new Set([...prev, row.id])]);
                            else setSelectedDeliveryOrderIds((prev) => prev.filter((id) => id !== row.id));
                          }}
                          className="h-4 w-4 accent-primary"
                        />
                      </td>
                      <td className="px-5 py-3 font-semibold text-primary">
                        <button type="button" onClick={() => setDeliveryDetailModalOrderId(row.id)} className="font-bold text-primary hover:underline">
                          {row.orderId}
                        </button>
                      </td>
                      <td className="px-5 py-3">{row.createdAt}</td>
                      <td className="px-5 py-3">{row.outlet}</td>
                      <td className="px-5 py-3">RM {row.revenue.toFixed(2)}</td>
                      <td className="px-5 py-3">{row.soldPieces}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </UnifiedTable>
          )}
        </>
      ) : (
        <>
          {userView === "dashboard" ? (
            <>
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DashboardMetricCard label="活跃会员" value={String(memberDashboardActiveCount)} hint="有线上订单或门店扫码行为的会员数" tone="primary" />
                <DashboardMetricCard label="总消费额" value={formatCurrencyValue(memberDashboardTotalSpend)} hint="线上与门店消费的合计" />
                <DashboardMetricCard label="人均消费" value={formatCurrencyValue(memberDashboardAvgSpend)} hint="按活跃会员平均" tone="emerald" />
                <DashboardMetricCard label="门店扫码次数" value={String(memberDashboardScanCount)} hint="会员到店互动热度" tone="amber" />
              </section>

              <section className="grid gap-3 md:grid-cols-3">
                <article className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-900/20">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-300">新客（30天内注册）</p>
                  <p className="mt-2 text-2xl font-black text-sky-700 dark:text-sky-300">{userSegments.newUsers}</p>
                </article>
                <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-300">沉睡会员（60天未活跃）</p>
                  <p className="mt-2 text-2xl font-black text-amber-700 dark:text-amber-300">{userSegments.dormantUsers}</p>
                </article>
                <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-300">高活跃会员（5次+）</p>
                  <p className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300">{userSegments.highEngagementUsers}</p>
                </article>
              </section>
              <section className="grid gap-3 md:grid-cols-3">
                <DashboardMetricCard label="复购会员数" value={String(memberDashboardRepeatMembers)} hint="至少发生 2 次有效消费或门店行为" />
                <DashboardMetricCard label="近30天回流会员" value={String(recentlyReturnedMemberCount)} hint="前后两次行为相隔至少 30 天，且最近一次在近 30 天内" tone="amber" />
                <DashboardMetricCard label="已升级等级会员" value={String(upgradedTierMemberCount)} hint="当前等级不为 none 的会员数，用于近似观察升级规模" tone="emerald" />
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <TrendBars title="活跃会员趋势" subtitle={`${granularityLabel}去重后的活跃会员数，综合线上订单与门店扫码。`} data={memberActivityTrendData} badge={trendBadge} />
                <DonutBreakdown title="消费结构" subtitle="区分会员在线上与门店的消费分布。" slices={memberSpendMixData} centerLabel={formatCompactValue(memberDashboardTotalSpend)} />
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <DonutBreakdown title="会员等级分布" subtitle="看当前筛选下各等级会员构成。" slices={memberTierSlicesData} centerLabel={String(memberDashboardActiveCount)} />
                <HorizontalBars
                  title="渠道偏好"
                  subtitle="有实际消费或行为的会员在不同渠道的覆盖情况。"
                  data={memberChannelPreferenceData}
                  suffix=" 人"
                />
              </section>
              <section className="grid gap-4 xl:grid-cols-2">
                <HorizontalBars title="高价值会员 Top 10" subtitle="按总消费额排序，帮助锁定高价值会员。" data={memberTopSpendersData} prefix="RM " />
                <HorizontalBars title="门店到访热度" subtitle="统计扫码次数最多的门店，反映线下会员互动热区。" data={memberOutletVisitsData} suffix=" 次" />
              </section>
            </>
          ) : (
            <UnifiedTable
              title="会员行为详细报表"
              description="展示会员线上下单、到店扫码与消费表现。"
              toolbar={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={exportUserStatement}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
                  >
                    导出 Statement
                  </button>
                  <button
                    type="button"
                    onClick={exportUserCsv}
                    disabled={visibleSelectedUserIds.length === 0}
                    className="rounded-lg border border-primary/30 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    导出 CSV（已选 {visibleSelectedUserIds.length}）
                  </button>
                </div>
              }
            >
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={userAllSelected}
                        onChange={(event) => {
                          if (event.target.checked) setSelectedUserIds(filteredUserBehaviorRows.map((row) => row.userId));
                          else setSelectedUserIds([]);
                        }}
                        className="h-4 w-4 accent-primary"
                      />
                    </th>
                    <th className="px-5 py-3">会员</th>
                    <th className="px-5 py-3">等级</th>
                    <th className="px-5 py-3">商城单</th>
                    <th className="px-5 py-3">外卖单</th>
                    <th className="px-5 py-3">门店扫码</th>
                    <th className="px-5 py-3">线上消费</th>
                    <th className="px-5 py-3">门店消费</th>
                    <th className="px-5 py-3">总消费</th>
                    <th className="px-5 py-3">偏好门店</th>
                    <th className="px-5 py-3">最近活跃</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUserBehaviorRows.map((row) => (
                    <tr key={row.userId} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(row.userId)}
                          onChange={(event) => {
                            if (event.target.checked) setSelectedUserIds((prev) => [...new Set([...prev, row.userId])]);
                            else setSelectedUserIds((prev) => prev.filter((id) => id !== row.userId));
                          }}
                          className="h-4 w-4 accent-primary"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <button type="button" onClick={() => openUserDetailModal(row.userId)} className="font-semibold text-primary hover:underline">
                          {row.fullName}
                        </button>
                        <p className="text-xs text-slate-500 dark:text-slate-300">{row.phone}</p>
                      </td>
                      <td className="px-5 py-3">{row.tier}</td>
                      <td className="px-5 py-3">{row.shopOrderCount}</td>
                      <td className="px-5 py-3">{row.deliveryOrderCount}</td>
                      <td className="px-5 py-3">{row.dineInScanCount}</td>
                      <td className="px-5 py-3">RM {row.onlineSpend.toFixed(2)}</td>
                      <td className="px-5 py-3">RM {row.dineInSpend.toFixed(2)}</td>
                      <td className="px-5 py-3 font-black">RM {row.totalSpend.toFixed(2)}</td>
                      <td className="px-5 py-3">{row.topOutlet}</td>
                      <td className="px-5 py-3 text-xs">{row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleString("zh-CN", { hour12: false }) : "-"}</td>
                    </tr>
                  ))}
                  {filteredUserBehaviorRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-300">
                        暂无匹配会员数据
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </UnifiedTable>
          )}
        </>
      )}

      <UnifiedModal
        open={Boolean(shopDetailModalOrderId && selectedShopDetailRow)}
        size="lg"
        title={`商城订单 ${selectedShopDetailRow?.orderId ?? ""}`}
        description="当前筛选下该订单的销售摘要与明细"
        onClose={() => setShopDetailModalOrderId(null)}
        actions={
          <button type="button" onClick={() => setShopDetailModalOrderId(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            关闭
          </button>
        }
      >
        {selectedShopDetailRow && selectedShopOrder ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-300">下单时间</p>
                <p className="mt-1 font-bold">{selectedShopDetailRow.createdAt}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-300">状态</p>
                <p className="mt-1 font-bold">{selectedShopOrder.status || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-300">销售额</p>
                <p className="mt-1 font-bold">RM {selectedShopDetailRow.revenue.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-300">区域 / 包数</p>
                <p className="mt-1 font-bold">
                  {selectedShopDetailRow.region} / {selectedShopDetailRow.packages}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-4 py-2">商品</th>
                    <th className="px-4 py-2">类型</th>
                    <th className="px-4 py-2">数量</th>
                    <th className="px-4 py-2">单价</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedShopItems.map((item) => (
                    <tr key={`${item.order_id}-${item.item_id}-${item.item_type}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2">{item.title?.trim() || item.item_id.slice(0, 8)}</td>
                      <td className="px-4 py-2">{item.item_type === "bundle" ? "套餐" : item.item_type === "soup_pack_variant" ? "单品" : "其他"}</td>
                      <td className="px-4 py-2">{item.quantity}</td>
                      <td className="px-4 py-2">RM {toNumber(item.unit_price).toFixed(2)}</td>
                    </tr>
                  ))}
                  {selectedShopItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-slate-500 dark:text-slate-300">
                        无商品明细
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </UnifiedModal>

      <UnifiedModal
        open={Boolean(deliveryDetailModalOrderId && selectedDeliveryDetailRow)}
        size="lg"
        title={`外卖订单 ${selectedDeliveryDetailRow?.orderId ?? ""}`}
        description="当前筛选下该订单的销售摘要与菜品明细"
        onClose={() => setDeliveryDetailModalOrderId(null)}
        actions={
          <button type="button" onClick={() => setDeliveryDetailModalOrderId(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            关闭
          </button>
        }
      >
        {selectedDeliveryDetailRow && selectedDeliveryOrder ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-300">下单时间</p>
                <p className="mt-1 font-bold">{selectedDeliveryDetailRow.createdAt}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-300">状态</p>
                <p className="mt-1 font-bold">{selectedDeliveryOrder.status || "-"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-300">销售额</p>
                <p className="mt-1 font-bold">RM {selectedDeliveryDetailRow.revenue.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-300">分店 / 单品销量</p>
                <p className="mt-1 font-bold">
                  {selectedDeliveryDetailRow.outlet} / {selectedDeliveryDetailRow.soldPieces}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-4 py-2">菜品</th>
                    <th className="px-4 py-2">分类</th>
                    <th className="px-4 py-2">数量</th>
                    <th className="px-4 py-2">单价</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDeliveryItems
                    .filter((item) => item.item_type === "menu_item")
                    .map((item) => (
                      <tr key={`${item.order_id}-${item.item_id}-${item.item_type}`} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-2">{item.title?.trim() || item.item_id.slice(0, 8)}</td>
                        <td className="px-4 py-2">{menuItemCategories.get(item.item_id) ?? "未分类"}</td>
                        <td className="px-4 py-2">{item.quantity}</td>
                        <td className="px-4 py-2">RM {toNumber(item.unit_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  {selectedDeliveryItems.filter((item) => item.item_type === "menu_item").length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-slate-500 dark:text-slate-300">
                        无菜品明细
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </UnifiedModal>

      <UnifiedModal
        open={Boolean(userDetailModalUserId)}
        size="xl"
        title="会员行为详情"
        description="展示该会员在筛选周期内的订单、门店扫码与积分流水。"
        onClose={closeUserDetailModal}
        actions={
          <>
            <button type="button" onClick={exportSingleUserCsv} className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10">
              导出该会员 CSV
            </button>
            <button type="button" onClick={closeUserDetailModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
              关闭
            </button>
          </>
        }
      >
        {userDetailModalUserId ? (
          <>
            {!selectedUserDetailRow ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">暂无会员数据</p>
            ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                      <p className="text-xs text-slate-500 dark:text-slate-300">会员</p>
                      <p className="mt-1 font-bold">{selectedUserDetailRow.fullName}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                      <p className="text-xs text-slate-500 dark:text-slate-300">等级</p>
                      <p className="mt-1 font-bold">{selectedUserDetailRow.tier}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                      <p className="text-xs text-slate-500 dark:text-slate-300">总消费</p>
                      <p className="mt-1 font-bold">RM {selectedUserDetailRow.totalSpend.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                      <p className="text-xs text-slate-500 dark:text-slate-300">最近活跃</p>
                      <p className="mt-1 font-bold">{selectedUserDetailRow.lastActiveAt ? new Date(selectedUserDetailRow.lastActiveAt).toLocaleString("zh-CN", { hour12: false }) : "-"}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm font-bold dark:border-slate-700">
                      <span>线上订单（{userDetailOrders.length}）</span>
                      <div className="flex items-center gap-2 text-xs">
                        <button type="button" disabled={userDetailOrderPage <= 1} onClick={() => setUserDetailOrderPage((prev) => Math.max(1, prev - 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-600">上一页</button>
                        <span>{userDetailOrderPage}/{userDetailOrderPageCount}</span>
                        <button type="button" disabled={userDetailOrderPage >= userDetailOrderPageCount} onClick={() => setUserDetailOrderPage((prev) => Math.min(userDetailOrderPageCount, prev + 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-600">下一页</button>
                      </div>
                    </div>
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                          <th className="px-4 py-2">时间</th>
                          <th className="px-4 py-2">渠道</th>
                          <th className="px-4 py-2">状态</th>
                          <th className="px-4 py-2">金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userDetailOrdersPageRows.map((order) => (
                          <tr key={order.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-4 py-2 text-xs">{new Date(order.created_at).toLocaleString("zh-CN", { hour12: false })}</td>
                            <td className="px-4 py-2">{order.channel === "shop" ? "商城" : "外卖"}</td>
                            <td className="px-4 py-2">{order.status || "-"}</td>
                            <td className="px-4 py-2">RM {toNumber(order.total).toFixed(2)}</td>
                          </tr>
                        ))}
                        {userDetailOrders.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-500 dark:text-slate-300">暂无线上订单</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm font-bold dark:border-slate-700">
                      <span>门店扫码（{userDetailDineInRows.length}）</span>
                      <div className="flex items-center gap-2 text-xs">
                        <button type="button" disabled={userDetailDineInPage <= 1} onClick={() => setUserDetailDineInPage((prev) => Math.max(1, prev - 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-600">上一页</button>
                        <span>{userDetailDineInPage}/{userDetailDineInPageCount}</span>
                        <button type="button" disabled={userDetailDineInPage >= userDetailDineInPageCount} onClick={() => setUserDetailDineInPage((prev) => Math.min(userDetailDineInPageCount, prev + 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-600">下一页</button>
                      </div>
                    </div>
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                          <th className="px-4 py-2">时间</th>
                          <th className="px-4 py-2">门店</th>
                          <th className="px-4 py-2">状态</th>
                          <th className="px-4 py-2">消费额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userDetailDineInPageRows.map((dineIn) => (
                          <tr key={dineIn.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-4 py-2 text-xs">{new Date(dineIn.submitted_at).toLocaleString("zh-CN", { hour12: false })}</td>
                            <td className="px-4 py-2">{dineIn.official_outlets?.name?.trim() || "未知门店"}</td>
                            <td className="px-4 py-2">{dineIn.status}</td>
                            <td className="px-4 py-2">RM {toNumber(dineIn.spend_amount).toFixed(2)}</td>
                          </tr>
                        ))}
                        {userDetailDineInRows.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-500 dark:text-slate-300">暂无扫码记录</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm font-bold dark:border-slate-700">
                      <span>积分流水（{userDetailPointsRows.length}）</span>
                      <div className="flex items-center gap-2 text-xs">
                        <button type="button" disabled={userDetailPointsPage <= 1} onClick={() => setUserDetailPointsPage((prev) => Math.max(1, prev - 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-600">上一页</button>
                        <span>{userDetailPointsPage}/{userDetailPointsPageCount}</span>
                        <button type="button" disabled={userDetailPointsPage >= userDetailPointsPageCount} onClick={() => setUserDetailPointsPage((prev) => Math.min(userDetailPointsPageCount, prev + 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-600">下一页</button>
                      </div>
                    </div>
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                          <th className="px-4 py-2">积分时间</th>
                          <th className="px-4 py-2">类型</th>
                          <th className="px-4 py-2">渠道</th>
                          <th className="px-4 py-2">积分变化</th>
                          <th className="px-4 py-2">来源</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userDetailPointsPageRows.map((point) => (
                          <tr key={point.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-4 py-2 text-xs">{new Date(point.created_at).toLocaleString("zh-CN", { hour12: false })}</td>
                            <td className="px-4 py-2">{point.reason}</td>
                            <td className="px-4 py-2">{point.channel}</td>
                            <td className={`px-4 py-2 font-bold ${Number(point.points_delta) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {Number(point.points_delta) >= 0 ? "+" : ""}
                              {Number(point.points_delta).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-xs">
                              <p>{point.source_type}</p>
                              <p>{point.source_id}</p>
                            </td>
                          </tr>
                        ))}
                        {!userDetailLoading && userDetailPointsRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-4 text-center text-slate-500 dark:text-slate-300">
                              暂无积分流水
                            </td>
                          </tr>
                        ) : null}
                        {userDetailLoading ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-4 text-center text-slate-500 dark:text-slate-300">
                              加载中...
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
          </>
        ) : null}
      </UnifiedModal>
    </div>
  );
}
