"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { BouncyActionButton } from "@/components/bouncy-action-button";
import { fetchActivePromotionsPublic, type OfficialPromotion } from "@/lib/admin/official-platform";
import {
  fetchOfficialMenuCategories,
  fetchOfficialMenuItemsWithOptionGroups,
  sortOfficialMenuItemsByCategoryOrder,
  type OfficialMenuCategory,
  type OfficialMenuItemWithOptionGroups,
  type OfficialMenuOptionGroup,
} from "@/lib/admin/official-delivery";
import { useSuccessPulse } from "@/hooks/use-success-pulse";
import { supabase } from "@/lib/supabase";
import { requestDeliveryQuote } from "@/lib/delivery/lalamove";
import { createPayexIntent, fetchPayexPaymentStatus } from "@/lib/payments/payex";
import { UnifiedModal } from "@/components/unified-modal";
import { MemberCouponDropdown, type MemberCouponDropdownOption } from "@/components/member-coupon-dropdown";
import Link from "next/link";
import {
  addDeliveryCartItem,
  buildDeliveryCartItemTitle,
  countDeliveryCartItems,
  formatDeliveryCartOptionSummary,
  readDeliveryCart,
  setDeliveryCartItemQuantity,
  type DeliveryCartItem,
  type DeliveryCartSelectedOption,
  type DeliveryCartState,
} from "@/lib/delivery-cart";

type UserCouponOption = {
  id: string;
  coupon_instance_code: string;
  status: "issued" | "redeemed" | "expired" | "revoked";
  expires_at: string | null;
  reserved_order_id: string | null;
  official_coupon_templates?: {
    code?: string | null;
    title?: string | null;
    discount_type?: "percent" | "fixed_amount" | null;
    percent_off?: number | null;
    amount_off_myr?: number | null;
    amount_off_sgd?: number | null;
    min_spend_myr?: number | null;
    min_spend_sgd?: number | null;
    applies_channels?: string[] | null;
    stackable?: boolean | null;
    status?: "enabled" | "disabled" | null;
    starts_at?: string | null;
    ends_at?: string | null;
  } | null;
};

type AddressSuggestion = {
  label: string;
  detail: string;
  lat: number;
  lng: number;
};

const PICKUP_POINT = {
  address: "3, Jalan Mawar, Seksyen 10, Taman Perindustrian Bukit Serdang, 43300 Seri Kembangan, Selangor, Malaysia",
  coordinates: { lat: 3.0407659, lng: 101.6992641 },
};
const QUOTE_SERVICE_TYPES = ["MOTORCYCLE", "CAR"] as const;

function parseProfileAddress(raw: string | null | undefined) {
  const value = (raw ?? "").trim();
  if (!value) return { address: "", postcode: "" };
  if (value.includes("|")) {
    const [address1 = "", address2 = "", postalCode = "", state = "", country = ""] = value.split("|").map((item) => item.trim());
    const mergedAddress = [address1, address2, state, country].filter(Boolean).join(", ");
    return { address: mergedAddress, postcode: postalCode };
  }
  return { address: value, postcode: "" };
}

type DeliveryOptionSelectionState = Record<string, string[]>;

function buildInitialOptionSelections(groups: OfficialMenuOptionGroup[]): DeliveryOptionSelectionState {
  return groups.reduce<DeliveryOptionSelectionState>((acc, group) => {
    acc[group.id] = [];
    return acc;
  }, {});
}

function buildSelectedOptions(
  groups: OfficialMenuOptionGroup[],
  selections: DeliveryOptionSelectionState,
): DeliveryCartSelectedOption[] {
  return groups.flatMap((group) => {
    const selectedIds = new Set(selections[group.id] ?? []);
    return (group.official_menu_option_options ?? [])
      .filter((option) => selectedIds.has(option.id))
      .map((option) => ({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDelta: Number(option.price_delta ?? 0),
      }));
  });
}

function validateOptionSelections(groups: OfficialMenuOptionGroup[], selections: DeliveryOptionSelectionState) {
  for (const group of groups) {
    const count = (selections[group.id] ?? []).length;
    const minSelect = Math.max(group.required ? 1 : 0, Number(group.min_select ?? 0));
    const maxSelect = Math.max(Number(group.max_select ?? 0), minSelect);
    if (count < minSelect) {
      return `${group.name} 至少选择 ${minSelect} 项`;
    }
    if (count > maxSelect) {
      return `${group.name} 最多选择 ${maxSelect} 项`;
    }
  }
  return null;
}

function buildOptionVisualLabel(name: string) {
  const compact = name.replace(/\s+/g, " ").trim();
  const cjk = compact.match(/[\u4e00-\u9fff]{1,4}/g)?.join("").slice(0, 4);
  if (cjk) return cjk;
  const latinWords = compact
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (latinWords.length === 0) return "SET";
  return latinWords.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function normalizeOptionLookupName(name: string) {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

export default function DeliveryPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileCategoryMenuOpen, setMobileCategoryMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [categories, setCategories] = useState<OfficialMenuCategory[] | null>(null);
  const [menuItems, setMenuItems] = useState<OfficialMenuItemWithOptionGroups[] | null>(null);
  const [cart, setCart] = useState<DeliveryCartState>({ items: [] });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [promotions, setPromotions] = useState<OfficialPromotion[] | null>(null);
  const [promoIndex, setPromoIndex] = useState(0);
  const [brokenImageIds, setBrokenImageIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSearchOpen, setAddressSearchOpen] = useState(false);
  const [addressSearching, setAddressSearching] = useState(false);
  const [deliveryRemark, setDeliveryRemark] = useState("");
  const [userCoupons, setUserCoupons] = useState<UserCouponOption[]>([]);
  const [selectedCouponCodes, setSelectedCouponCodes] = useState<string[]>([]);
  const [serviceType, setServiceType] = useState<(typeof QUOTE_SERVICE_TYPES)[number]>("MOTORCYCLE");
  const [contactCollapsed, setContactCollapsed] = useState(true);
  const [useProfileShipping, setUseProfileShipping] = useState(false);
  const [profileShipping, setProfileShipping] = useState<{ name: string; phone: string; address: string } | null>(null);
  const [dropoffCoordinates, setDropoffCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [optionModalItem, setOptionModalItem] = useState<OfficialMenuItemWithOptionGroups | null>(null);
  const [optionSelections, setOptionSelections] = useState<DeliveryOptionSelectionState>({});
  const [optionError, setOptionError] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [quotationId, setQuotationId] = useState<string | null>(null);
  const [quotationExpiresAt, setQuotationExpiresAt] = useState<string | null>(null);
  const [quotationTotalText, setQuotationTotalText] = useState<string | null>(null);
  const [quotationFee, setQuotationFee] = useState<number | null>(null);
  const [quotationServiceType, setQuotationServiceType] = useState<string | null>(null);
  const [quoteRefreshing, setQuoteRefreshing] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [officialOrderId, setOfficialOrderId] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);
  const [deliveryEvents, setDeliveryEvents] = useState<Array<{ id: string; step: string; created_at: string }>>([]);
  const [deliveryOrderId, setDeliveryOrderId] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [couponEvaluationTime] = useState(() => Date.now());
  const dropoffCoordinatesRef = useRef<{ lat: number; lng: number } | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const { trigger: triggerAddedPulse, isActive: isAddedPulsing } = useSuccessPulse(700);

  useEffect(() => {
    let active = true;
    Promise.all([fetchOfficialMenuCategories(), fetchOfficialMenuItemsWithOptionGroups("ala_carte"), fetchActivePromotionsPublic("delivery")]).then(
      ([cats, items, rows]) => {
        if (!active) return;
        setCategories(cats);
        setMenuItems(sortOfficialMenuItemsByCategoryOrder(items.filter((x) => x.is_active), cats));
        setPromotions(rows);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    const loadSession = async () => {
      const sessionRes = await client.auth.getSession();
      const userId = sessionRes.data.session?.user?.id;
      if (!active) return;
      setIsAuthed(Boolean(userId));
      if (!userId) return;
      const profileRes = await client.from("official_profiles").select("full_name,phone,address").eq("id", userId).maybeSingle();
      const couponRes = await client
        .from("official_user_coupons")
        .select("id,coupon_instance_code,status,expires_at,reserved_order_id,official_coupon_templates(code,title,discount_type,percent_off,amount_off_myr,amount_off_sgd,min_spend_myr,min_spend_sgd,applies_channels,stackable,status,starts_at,ends_at)")
        .eq("user_id", userId)
        .eq("status", "issued")
        .order("issued_at", { ascending: false });
      if (!active || profileRes.error || !profileRes.data) return;
      const parsed = parseProfileAddress((profileRes.data as { address?: string | null }).address ?? "");
      setProfileShipping({
        name: ((profileRes.data as { full_name?: string | null }).full_name ?? "").trim(),
        phone: ((profileRes.data as { phone?: string | null }).phone ?? "").trim(),
        address: parsed.address,
      });
      if (!couponRes.error) setUserCoupons((couponRes.data ?? []) as UserCouponOption[]);
    };
    void loadSession();
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session?.user?.id));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const promoText = useMemo(() => {
    if (!promotions || promotions.length === 0) return null;
    return promotions[0]?.title ?? null;
  }, [promotions]);

  const promoSlides = useMemo(() => {
    return promotions ?? [];
  }, [promotions]);

  useEffect(() => {
    if (!promoSlides.length) return;
    const timer = window.setInterval(() => {
      setPromoIndex((prev) => (prev + 1) % promoSlides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [promoSlides.length]);

  const activePromoIndex = promoSlides.length > 0 ? promoIndex % promoSlides.length : 0;
  const activePromo = promoSlides[activePromoIndex] ?? null;
  const deliveryFaqItems = [
    {
      question: "男朋友火锅外卖提供什么服务？",
      answer: "火锅外卖页面提供现煮火锅菜品、汤底与配料选择，用户可先填写地址取得配送报价，再完成付款与派送。",
    },
    {
      question: "火锅外卖和商城商品有什么区别？",
      answer: "火锅外卖适合即点即送、当餐食用；商城则更适合买可冷冻保存的汤包、汤底和礼盒，用于囤货或送礼。",
    },
    {
      question: "外卖下单前最重要的确认点是什么？",
      answer: "建议先确认收货地址、配送方式、预计配送费与菜品内容；如果想快速选组合，可先看 Bundle Set 页面获取灵感。",
    },
  ];

  const promoMeta = useMemo(() => {
    if (!activePromo) return "";
    if (activePromo.schedule_kind === "range") {
      if (activePromo.starts_at && activePromo.ends_at) {
        return `${new Date(activePromo.starts_at).toLocaleDateString()} - ${new Date(activePromo.ends_at).toLocaleDateString()}`;
      }
      return "限时活动";
    }
    if (activePromo.schedule_kind === "daily_window") {
      return activePromo.daily_start && activePromo.daily_end ? `每日 ${activePromo.daily_start} - ${activePromo.daily_end}` : "每日活动";
    }
    if (activePromo.schedule_kind === "weekly") {
      return activePromo.weekly_days?.length ? `每周 ${activePromo.weekly_days.join(" / ")}` : "每周活动";
    }
    return "活动进行中";
  }, [activePromo]);

  const handleIncrement = (id: string) => {
    if (!isAuthed) {
      setAuthPromptOpen(true);
      return;
    }
    const item = (menuItems ?? []).find((entry) => entry.id === id);
    if (!item) return;
    if (item.option_groups.length > 0) {
      setOptionModalItem(item);
      setOptionSelections(buildInitialOptionSelections(item.option_groups));
      setOptionError(null);
      return;
    }
    addDeliveryCartItem({
      itemId: item.id,
      title: item.name,
      imageUrl: item.image_url ?? null,
      unitPrice: Number(item.base_price),
      selectedOptions: [],
    });
    triggerAddedPulse(id);
  };

  const handleDecrement = (lineKey: string) => {
    const line = readDeliveryCart().items.find((item) => item.key === lineKey);
    if (!line) return;
    setDeliveryCartItemQuantity(lineKey, Math.max(0, line.quantity - 1));
  };

  const handleIncrementCartLine = (line: DeliveryCartItem) => {
    addDeliveryCartItem(
      {
        itemId: line.itemId,
        title: line.title,
        imageUrl: line.imageUrl,
        unitPrice: line.unitPrice,
        selectedOptions: line.selectedOptions,
      },
      1,
    );
    triggerAddedPulse(line.itemId);
  };

  const closeOptionModal = useCallback(() => {
    setOptionModalItem(null);
    setOptionSelections({});
    setOptionError(null);
  }, []);

  const toggleOptionSelection = useCallback((group: OfficialMenuOptionGroup, optionId: string) => {
    setOptionSelections((prev) => {
      const current = prev[group.id] ?? [];
      const maxSelect = Math.max(Number(group.max_select ?? 0), Math.max(group.required ? 1 : 0, Number(group.min_select ?? 0)));
      if (maxSelect <= 1) {
        return { ...prev, [group.id]: current[0] === optionId ? [] : [optionId] };
      }
      const exists = current.includes(optionId);
      if (exists) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= maxSelect) {
        setOptionError(`${group.name} 最多选择 ${maxSelect} 项`);
        return prev;
      }
      return { ...prev, [group.id]: [...current, optionId] };
    });
    setOptionError(null);
  }, []);

  const selectedModalOptions = useMemo(
    () => (optionModalItem ? buildSelectedOptions(optionModalItem.option_groups, optionSelections) : []),
    [optionModalItem, optionSelections],
  );

  const optionModalUnitPrice = useMemo(() => {
    if (!optionModalItem) return 0;
    return Number(optionModalItem.base_price) + selectedModalOptions.reduce((sum, option) => sum + option.priceDelta, 0);
  }, [optionModalItem, selectedModalOptions]);

  const confirmOptionSelection = useCallback(() => {
    if (!optionModalItem) return;
    const validationMessage = validateOptionSelections(optionModalItem.option_groups, optionSelections);
    if (validationMessage) {
      setOptionError(validationMessage);
      return;
    }
    addDeliveryCartItem({
      itemId: optionModalItem.id,
      title: optionModalItem.name,
      imageUrl: optionModalItem.image_url ?? null,
      unitPrice: optionModalUnitPrice,
      selectedOptions: selectedModalOptions,
    });
    triggerAddedPulse(optionModalItem.id);
    closeOptionModal();
  }, [closeOptionModal, optionModalItem, optionModalUnitPrice, optionSelections, selectedModalOptions, triggerAddedPulse]);

  const filteredItems = useMemo(() => {
    const rows = menuItems ?? [];
    const categoryFiltered = activeCategory === "all" ? rows : rows.filter((item) => item.category_id === activeCategory);
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return categoryFiltered;
    return categoryFiltered.filter((item) => {
      const haystack = [item.name, item.description, ...(item.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [menuItems, activeCategory, searchQuery]);

  const selectedCategoryName = useMemo(() => {
    if (activeCategory === "all") return "全部菜品";
    return categories?.find((x) => x.id === activeCategory)?.name ?? "菜品";
  }, [activeCategory, categories]);

  const itemMap = useMemo(() => {
    return new Map((menuItems ?? []).map((item) => [item.id, item]));
  }, [menuItems]);

  const optionImageByName = useMemo(() => {
    const map = new Map<string, { src: string; alt: string }>();
    for (const item of menuItems ?? []) {
      const key = normalizeOptionLookupName(item.name);
      if (!key || !item.image_url || map.has(key)) continue;
      map.set(key, { src: item.image_url, alt: item.name });
    }
    return map;
  }, [menuItems]);

  const cartLines = useMemo(() => cart.items, [cart]);

  const itemQtyMap = useMemo(() => {
    return cartLines.reduce<Map<string, number>>((acc, line) => {
      acc.set(line.itemId, (acc.get(line.itemId) ?? 0) + line.quantity);
      return acc;
    }, new Map());
  }, [cartLines]);

  const subtotal = cartLines.reduce((acc, line) => acc + line.unitPrice * line.quantity, 0);

  const deliveryFee = quotationFee ?? 0;
  const sst = subtotal * 0.06;
  const userCouponOptions = useMemo<
    Array<
      MemberCouponDropdownOption & {
        selected: boolean;
        stackable: boolean;
        disabledReason: string | null;
        discountAmount: number;
      }
    >
  >(() => {
    const now = couponEvaluationTime;
    const selectedSet = new Set(selectedCouponCodes);
    const selectedRows = userCoupons.filter((coupon) => selectedSet.has(coupon.coupon_instance_code));
    const hasSelectedNonStackable = selectedRows.some((coupon) => !coupon.official_coupon_templates?.stackable);
    return userCoupons.map((coupon) => {
      const template = coupon.official_coupon_templates;
      const selected = selectedSet.has(coupon.coupon_instance_code);
      let disabledReason: string | null = null;
      if (coupon.status !== "issued") disabledReason = "当前状态不可使用";
      else if (coupon.reserved_order_id) disabledReason = "已被其他订单占用";
      else if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) disabledReason = "优惠券已过期";
      else if (!template || template.status !== "enabled") disabledReason = "优惠券模板不可用";
      else if (template.starts_at && new Date(template.starts_at).getTime() > now) disabledReason = "尚未生效";
      else if (template.ends_at && new Date(template.ends_at).getTime() < now) disabledReason = "模板已过期";
      else if ((template.applies_channels ?? []).length > 0 && !(template.applies_channels ?? []).includes("delivery")) disabledReason = "不可用于外卖";
      else {
        const minSpend = Number(template.min_spend_myr ?? 0);
        if (subtotal < minSpend) disabledReason = `未达到最低消费 RM ${minSpend.toFixed(2)}`;
      }

      if (!selected && !disabledReason) {
        if (hasSelectedNonStackable) disabledReason = "已选择不可叠加优惠券";
        else if (!template?.stackable && selectedCouponCodes.length > 0) disabledReason = "该优惠券不可与其他券叠加";
      }

      let discountAmount = 0;
      if (template?.discount_type === "percent") discountAmount = subtotal * (Number(template.percent_off ?? 0) / 100);
      else discountAmount = Number(template?.amount_off_myr ?? 0);
      discountAmount = Math.max(0, Math.min(subtotal, Number(discountAmount.toFixed(2))));

      const valueLabel =
        template?.discount_type === "percent"
          ? `${Number(template.percent_off ?? 0).toFixed(0)}% OFF`
          : `RM ${discountAmount.toFixed(2)}`;

      return {
        code: coupon.coupon_instance_code,
        title: template?.title?.trim() || "优惠券",
        templateCode: template?.code?.trim() || coupon.coupon_instance_code,
        valueLabel,
        expiresAt: coupon.expires_at,
        stackable: Boolean(template?.stackable),
        disabledReason,
        selected,
        discountAmount,
      };
    });
  }, [couponEvaluationTime, selectedCouponCodes, subtotal, userCoupons]);

  useEffect(() => {
    const invalidSelected = userCouponOptions.filter((option) => option.selected && option.disabledReason).map((option) => option.code);
    if (invalidSelected.length === 0) return;
    const timer = window.setTimeout(() => {
      setSelectedCouponCodes((prev) => prev.filter((code) => !invalidSelected.includes(code)));
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [userCouponOptions]);

  const discount = useMemo(() => {
    let remaining = subtotal;
    let totalDiscount = 0;
    for (const code of selectedCouponCodes) {
      const option = userCouponOptions.find((item) => item.code === code);
      if (!option || option.disabledReason) continue;
      const nextDiscount = Math.min(remaining, option.discountAmount);
      remaining = Math.max(0, Number((remaining - nextDiscount).toFixed(2)));
      totalDiscount = Number((totalDiscount + nextDiscount).toFixed(2));
    }
    return totalDiscount;
  }, [selectedCouponCodes, subtotal, userCouponOptions]);
  const selectedCouponOptions = useMemo(
    () => userCouponOptions.filter((option) => option.selected && !option.disabledReason),
    [userCouponOptions],
  );
  const total = subtotal + deliveryFee + sst - discount;
  const cartCount = countDeliveryCartItems(cart);

  useEffect(() => {
    const sync = () => setCart(readDeliveryCart());
    sync();
    window.addEventListener("delivery:cart:change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("delivery:cart:change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const quotationRemainingText = useMemo(() => {
    if (!quotationExpiresAt) return null;
    const remainMs = new Date(quotationExpiresAt).getTime() - nowTs;
    if (remainMs <= 0) return "报价已过期";
    const totalSec = Math.floor(remainMs / 1000);
    const mm = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, "0");
    const ss = (totalSec % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }, [quotationExpiresAt, nowTs]);

  const deliveryStatusText = useMemo(() => {
    if (deliveryStatus === "requested") return "正在分配骑手";
    if (deliveryStatus === "in_transit") return "配送中";
    if (deliveryStatus === "completed") return "已送达";
    if (deliveryStatus === "cancelled") return "配送取消";
    return deliveryStatus;
  }, [deliveryStatus]);

  const fillShippingFromProfile = useCallback(() => {
    if (!profileShipping) {
      setCheckoutMessage("未找到个人信息地址资料，请先到个人信息页完善");
      setUseProfileShipping(false);
      return;
    }
    setCustomerName(profileShipping.name);
    setCustomerPhone(profileShipping.phone);
    setDropoffAddress(profileShipping.address);
    setCheckoutMessage(null);
  }, [profileShipping]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const timer = window.setTimeout(() => mobileSearchInputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [mobileSearchOpen]);

  useEffect(() => {
    dropoffCoordinatesRef.current = dropoffCoordinates;
  }, [dropoffCoordinates]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payexOrder = params.get("payex_order");
    const channel = params.get("payex_channel");
    if (!payexOrder || channel !== "delivery") return;
    let active = true;
    const run = async () => {
      setOfficialOrderId(payexOrder);
      const status = await fetchPayexPaymentStatus(payexOrder);
      if (!active) return;
      if (!status.ok) {
        setCheckoutMessage(`支付状态查询失败：${status.message}`);
        return;
      }
      const data = status.data as { data?: { payment?: { status?: string } } };
      const paymentStatus = data?.data?.payment?.status ?? "";
      if (paymentStatus === "succeeded") {
        setCheckoutMessage("支付成功，系统正在创建配送单");
      } else if (paymentStatus === "failed") {
        setCheckoutMessage("支付失败，请重试");
      } else {
        setCheckoutMessage("支付处理中，请稍后刷新状态");
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  const searchAddressSuggestions = useCallback(async (address: string): Promise<AddressSuggestion[]> => {
    const run = async (query: string) => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=my&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`,
      );
      if (!response.ok) return [];
      const list = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
      return list
        .map((item) => {
          const lat = Number(item?.lat ?? NaN);
          const lng = Number(item?.lon ?? NaN);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const isLikelyMalaysia = lat >= 0.8 && lat <= 7.6 && lng >= 99 && lng <= 119.5;
          if (!isLikelyMalaysia) return null;
          const displayName = (item.display_name ?? "").trim();
          const [label = displayName, ...rest] = displayName.split(",").map((part) => part.trim()).filter(Boolean);
          return {
            label,
            detail: rest.join(", "),
            lat,
            lng,
          } satisfies AddressSuggestion;
        })
        .filter((item): item is AddressSuggestion => Boolean(item));
    };

    const primary = await run(`${address}, Malaysia`);
    if (primary.length > 0) return primary;
    return run(address);
  }, []);

  const geocodeAddress = useCallback(async (address: string): Promise<{ lat: number; lng: number } | null> => {
    const suggestions = await searchAddressSuggestions(address);
    const first = suggestions[0];
    return first ? { lat: first.lat, lng: first.lng } : null;
  }, [searchAddressSuggestions]);

  const normalizeMyPhone = (input: string) => {
    const cleaned = input.replace(/[^\d+]/g, "").trim();
    if (!cleaned) return null;
    if (cleaned.startsWith("+")) {
      const isValid = /^\+[1-9]\d{7,14}$/.test(cleaned);
      return isValid ? cleaned : null;
    }
    const digits = cleaned.replace(/\D/g, "");
    if (digits.startsWith("60")) {
      const candidate = `+${digits}`;
      return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null;
    }
    if (digits.startsWith("0")) {
      const candidate = `+60${digits.slice(1)}`;
      return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null;
    }
    return null;
  };

  const parseQuotePayload = (payload: unknown) => {
    const source = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const quoteData = source?.data && typeof source.data === "object" ? (source.data as Record<string, unknown>) : source;
    if (!quoteData) return null;
    const currentQuotationId = typeof quoteData.quotationId === "string" ? quoteData.quotationId : "";
    if (!currentQuotationId) return null;

    const currentQuotationExpiresAt = typeof quoteData.expiresAt === "string" ? quoteData.expiresAt : null;
    const currentServiceType = typeof quoteData.serviceType === "string" ? quoteData.serviceType : null;
    const quoteStops = Array.isArray(quoteData.stops) ? (quoteData.stops as Array<{ stopId?: string }>) : [];
    const pickupStopId = quoteStops[0]?.stopId ?? "pickup-stop";
    const dropoffStopId = quoteStops[1]?.stopId ?? "dropoff-stop";
    const priceBreakdown = quoteData.priceBreakdown;
    const breakdown = priceBreakdown && typeof priceBreakdown === "object" ? (priceBreakdown as Record<string, unknown>) : null;
    const totalRaw = breakdown?.total;
    const currency = typeof breakdown?.currency === "string" ? breakdown.currency : "MYR";
    const feeNumber = typeof totalRaw === "number" ? totalRaw : typeof totalRaw === "string" ? Number(totalRaw) : NaN;
    const deliveryFeeAmount = Number.isFinite(feeNumber) ? feeNumber : null;
    const distanceValue = typeof (quoteData.distance as { value?: unknown } | undefined)?.value === "number" ? (quoteData.distance as { value: number }).value : null;

    return {
      quotationId: currentQuotationId,
      quotationExpiresAt: currentQuotationExpiresAt,
      quotationServiceType: currentServiceType,
      pickupStopId,
      dropoffStopId,
      priceBreakdown,
      distanceValue,
      currency,
      deliveryFeeAmount,
    };
  };

  const requestQuote = useCallback(
    async (dropoff: { address: string; coordinates: { lat: number; lng: number } }) => {
      const quoteResult = await requestDeliveryQuote({
        serviceType,
        stops: [
          {
            address: PICKUP_POINT.address,
            coordinates: PICKUP_POINT.coordinates,
          },
          {
            address: dropoff.address,
            coordinates: dropoff.coordinates,
          },
        ],
      });
      if (quoteResult.ok) return quoteResult.data;
      return { __quote_error_message: quoteResult.message };
    },
    [serviceType],
  );

  useEffect(() => {
    if (!dropoffAddress || cartCount === 0) {
      const timer = window.setTimeout(() => {
        setQuotationFee(null);
        setQuotationId(null);
        setQuotationExpiresAt(null);
        setQuotationTotalText(null);
        setQuotationServiceType(null);
        setQuoteError(null);
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setQuoteRefreshing(true);
      const resolvedCoordinates = dropoffCoordinatesRef.current ?? (await geocodeAddress(dropoffAddress));
      if (!active) return;
      if (!resolvedCoordinates) {
        setQuoteError("地址无法定位，请输入更完整地址（建议含城市/邮编）");
        setQuoteRefreshing(false);
        return;
      }
      setDropoffCoordinates(resolvedCoordinates);
      const quoteRaw = await requestQuote({
        address: dropoffAddress,
        coordinates: resolvedCoordinates,
      });
      if (!active) return;
      if (!("__quote_error_message" in quoteRaw)) {
        const parsed = parseQuotePayload(quoteRaw);
        if (parsed) {
          setQuotationId(parsed.quotationId);
          setQuotationExpiresAt(parsed.quotationExpiresAt);
          setQuotationFee(parsed.deliveryFeeAmount);
          setQuotationServiceType(parsed.quotationServiceType);
          setQuotationTotalText(parsed.deliveryFeeAmount !== null ? `${parsed.currency} ${parsed.deliveryFeeAmount.toFixed(2)}` : null);
          setQuoteError(null);
        }
      } else {
        setQuoteError(`报价失败：${quoteRaw.__quote_error_message}`);
      }
      setQuoteRefreshing(false);
    }, 600);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [dropoffAddress, cartCount, geocodeAddress, requestQuote]);

  useEffect(() => {
    if (useProfileShipping || dropoffAddress.trim().length < 6) {
      const timer = window.setTimeout(() => {
        setAddressSuggestions([]);
        setAddressSearchOpen(false);
        setAddressSearching(false);
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setAddressSearching(true);
      const suggestions = await searchAddressSuggestions(dropoffAddress.trim());
      if (!active) return;
      setAddressSuggestions(suggestions);
      setAddressSearchOpen(suggestions.length > 0);
      setAddressSearching(false);
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [dropoffAddress, searchAddressSuggestions, useProfileShipping]);

  useEffect(() => {
    if (!officialOrderId || !supabase) return;
    const client = supabase;
    let active = true;
    const run = async () => {
      const { data, error } = await client.functions.invoke("checkout-delivery", {
        body: { action: "status", officialOrderId },
      });
      if (!active || error) return;
      const payload = (data as { data?: { delivery?: { status?: string; lalamove_order_id?: string | null }; events?: Array<{ id: string; step: string; created_at: string }>; payment?: { status?: string } } })?.data;
      if (payload?.delivery) {
        setDeliveryStatus(payload.delivery.status ?? null);
        setDeliveryOrderId(payload.delivery.lalamove_order_id ?? null);
        setDeliveryEvents(payload.events ?? []);
        if (payload.delivery.lalamove_order_id) {
          setCheckoutMessage("下单成功：支付完成且配送单已创建");
        }
        return;
      }
      const paymentStatus = payload?.payment?.status ?? "";
      if (paymentStatus === "succeeded") {
        setCheckoutMessage("支付已确认，系统正在分配骑手");
      }
    };
    void run();
    const timer = window.setInterval(() => {
      void run();
    }, 8000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [officialOrderId]);

  const handleCheckout = async () => {
    if (!isAuthed) {
      setAuthPromptOpen(true);
      return;
    }
    if (!supabase) {
      setCheckoutMessage("下单失败：Supabase 未配置");
      return;
    }
    if (submitting) return;
    if (!cartCount) {
      setCheckoutMessage("请先添加商品");
      return;
    }
    if (!customerName || !customerPhone || !dropoffAddress) {
      setCheckoutMessage("请先填写收货人信息");
      return;
    }
    const normalizedRecipientPhone = normalizeMyPhone(customerPhone);
    if (!normalizedRecipientPhone) {
      setCheckoutMessage("收货人电话格式无效，请填写有效手机号（如 0123456789 或 +60123456789）");
      return;
    }

    setSubmitting(true);
    setGeocoding(true);
    setCheckoutMessage(null);
    setQuoteError(null);

    try {
      const resolvedCoordinates = dropoffCoordinates ?? (await geocodeAddress(dropoffAddress));
      if (!resolvedCoordinates) {
        setCheckoutMessage("无法解析送达地址，请填写更精确地址");
        return;
      }
      setDropoffCoordinates(resolvedCoordinates);

      const quoteRaw = await requestQuote({
        address: dropoffAddress,
        coordinates: resolvedCoordinates,
      });
      if ("__quote_error_message" in quoteRaw) {
        setCheckoutMessage(`报价失败：${quoteRaw.__quote_error_message}`);
        return;
      }

      const parsedQuote = parseQuotePayload(quoteRaw);
      if (!parsedQuote) {
        setCheckoutMessage("报价失败：未返回 quotationId");
        return;
      }
      const resolvedDeliveryFee = parsedQuote.deliveryFeeAmount ?? 0;
      const checkoutTotal = subtotal + resolvedDeliveryFee + sst - discount;
      setQuotationId(parsedQuote.quotationId);
      setQuotationExpiresAt(parsedQuote.quotationExpiresAt);
      setQuotationFee(parsedQuote.deliveryFeeAmount);
      setQuotationServiceType(parsedQuote.quotationServiceType);
      setQuotationTotalText(parsedQuote.deliveryFeeAmount !== null ? `${parsedQuote.currency} ${parsedQuote.deliveryFeeAmount.toFixed(2)}` : null);

      const cartItems = cartLines
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          id: item.itemId,
          title: buildDeliveryCartItemTitle(item),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));

      const { data: checkoutDataRaw, error: checkoutError } = await supabase.functions.invoke("checkout-delivery", {
        body: {
          action: "checkout",
          currency: "MYR",
          cartItems,
          shipping: {
            full_name: customerName,
            phone: customerPhone,
            address: dropoffAddress,
          },
          totals: {
            subtotal,
            shipping_fee: resolvedDeliveryFee,
            discount_total: discount,
            total: checkoutTotal,
          },
          couponCodes: selectedCouponCodes,
        },
      });
      if (checkoutError) {
        setCheckoutMessage(`支付失败：${checkoutError.message}`);
        return;
      }

      const checkoutData = (checkoutDataRaw as { data?: { officialOrderId?: string; outletId?: string | null; outletName?: string; paymentReference?: string } } | null)?.data;
      const nextOrderId = checkoutData?.officialOrderId ?? "";
      if (!nextOrderId) {
        setCheckoutMessage("支付失败：未返回订单号");
        return;
      }

      setOfficialOrderId(nextOrderId);
      const intent = await createPayexIntent({
        officialOrderId: nextOrderId,
        channel: "delivery",
        returnUrl: `${window.location.origin}/payment/result`,
        deliveryContext: {
          officialOrderId: nextOrderId,
          serviceType,
          quotationId: parsedQuote.quotationId,
          sender: {
            stopId: parsedQuote.pickupStopId,
            name: "NPY Hotpot",
            phone: "+60198433519",
          },
          recipients: [
            {
              stopId: parsedQuote.dropoffStopId,
              name: customerName,
              phone: normalizedRecipientPhone,
            },
          ],
          remarks: deliveryRemark.trim() || "delivery-web-checkout",
          metadata: checkoutData?.paymentReference ? { payment_reference: checkoutData.paymentReference } : {},
          dropoffAddress,
          dropoffCoordinates: resolvedCoordinates,
          pickupOutletId: checkoutData?.outletId ?? null,
          quotationExpiresAt: parsedQuote.quotationExpiresAt,
          distanceMeters: parsedQuote.distanceValue,
          priceBreakdown: parsedQuote.priceBreakdown,
        },
      });
      if (!intent.ok) {
        setCheckoutMessage(`支付会话创建失败：${intent.message}`);
        return;
      }
      const paymentUrl = ((intent.data as { data?: { paymentUrl?: string } } | null)?.data?.paymentUrl ?? "").toString();
      if (!paymentUrl) {
        setCheckoutMessage("支付会话创建失败：未返回支付链接");
        return;
      }
      window.location.href = paymentUrl;
    } catch {
      setCheckoutMessage("下单失败，请稍后重试");
    } finally {
      setGeocoding(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
      <Navbar onCartClick={() => router.push("/delivery/checkout")} cartCount={cartCount} />

      {/* Main Content Area */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-4 px-0 py-5 md:py-3 lg:px-4">
        {/* Left Sidebar Navigation */}
        <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-background-light p-3 dark:border-primary/10 dark:bg-background-dark md:sticky md:top-20 md:flex md:h-[calc(100vh-7.5rem)]">
          <div className="space-y-2">
            <button
              onClick={() => setActiveCategory("all")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                activeCategory === "all"
                  ? "bg-primary text-white font-bold shadow-lg shadow-primary/20"
                  : "hover:bg-slate-100 dark:hover:bg-primary/10 text-slate-600 dark:text-slate-400"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
              <span className="truncate text-sm">全部菜品</span>
            </button>
            {(categories ?? []).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                title={cat.name}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                  activeCategory === cat.id
                    ? "bg-primary text-white font-bold shadow-lg shadow-primary/20"
                    : "hover:bg-slate-100 dark:hover:bg-primary/10 text-slate-600 dark:text-slate-400"
                }`}
              >
                <span className="truncate text-sm">{cat.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-auto p-4 bg-primary/5 rounded-xl border border-primary/10">
            <p className="text-xs text-primary font-bold uppercase mb-1">店铺公告</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {promoText ?? "今日营业中，欢迎下单。"}
            </p>
          </div>
        </aside>

        {/* Menu Grid */}
        <main className="flex-1 scroll-smooth bg-slate-50/50 p-3 dark:bg-background-dark md:p-6">
          <section className="mb-5 rounded-2xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mb-6 md:p-6">
            <p className="text-[11px] font-black tracking-[0.16em] text-primary">HOTPOT DELIVERY</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100 md:text-4xl">
              男朋友火锅外卖
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 md:text-base">
              在线选择火锅外卖菜品、汤底与配料，先看配送报价再完成支付。若你想购买可囤货的即食汤包，可转到
              {" "}
              <Link href="/shop" className="font-bold text-primary hover:text-primary/80">
                商城专区
              </Link>
              ；想快速查看组合方案，也可浏览
              {" "}
              <Link href="/shop/bundles" className="font-bold text-primary hover:text-primary/80">
                Bundle Set
              </Link>
              。
            </p>
          </section>

          {activePromo ? (
            <section className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/15 via-primary/10 to-amber-100/40 p-4 dark:from-primary/20 dark:via-primary/15 dark:to-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black tracking-[0.14em] text-primary">DELIVERY PROMO</p>
                  <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{activePromo.title}</h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{promoMeta}</p>
                </div>
                {promoSlides.length > 1 ? (
                  <div className="flex items-center gap-1.5">
                    {promoSlides.map((promo, idx) => (
                      <button
                        key={promo.id}
                        type="button"
                        onClick={() => setPromoIndex(idx)}
                        className={`h-2.5 rounded-full transition-all ${idx === activePromoIndex ? "w-6 bg-primary" : "w-2.5 bg-primary/30 hover:bg-primary/50"}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              {activePromo.video_url ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/40 bg-black/40">
                  <video src={activePromo.video_url} autoPlay muted loop playsInline controls className="h-40 w-full object-cover md:h-48" />
                </div>
              ) : activePromo.image_url ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/40 bg-black/10">
                  <Image
                    src={activePromo.image_url}
                    alt={activePromo.title}
                    width={1200}
                    height={480}
                    className="h-40 w-full object-cover md:h-48"
                    unoptimized
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="mb-5 space-y-3 md:hidden">
            <div>
              <p className="text-2xl font-black">男朋友火锅外卖</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">在家也能吃火锅</p>
            </div>
            <div className="flex items-center gap-2">
              {mobileSearchOpen ? (
                <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-primary/10 bg-white px-3.5 dark:bg-slate-900/80">
                  <span className="material-symbols-outlined text-[20px] text-slate-400">search</span>
                  <input
                    ref={mobileSearchInputRef}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索"
                    className="w-full bg-transparent text-[13px] font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setMobileSearchOpen(false);
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10"
                    aria-label="关闭搜索"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </label>
              ) : (
                <>
                  <div className="relative min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setMobileCategoryMenuOpen((prev) => !prev)}
                      className="flex h-11 w-full items-center justify-between rounded-2xl border border-primary/10 bg-white px-3.5 text-left text-[13px] font-bold text-slate-900 outline-none transition focus:border-primary dark:bg-slate-900/80 dark:text-slate-100"
                      aria-haspopup="listbox"
                      aria-expanded={mobileCategoryMenuOpen}
                    >
                      <span className="truncate">{selectedCategoryName}</span>
                      <span className="material-symbols-outlined shrink-0 text-slate-400">expand_more</span>
                    </button>
                    {mobileCategoryMenuOpen ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-2xl dark:bg-slate-900/95">
                        <div className="max-h-72 overflow-y-auto py-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCategory("all");
                              setMobileCategoryMenuOpen(false);
                            }}
                            className={`block w-full px-3.5 py-2.5 text-left text-[13px] font-bold transition ${
                              activeCategory === "all"
                                ? "bg-primary/12 text-primary"
                                : "text-slate-900 hover:bg-black/5 dark:text-slate-100 dark:hover:bg-white/8"
                            }`}
                          >
                            全部菜品
                          </button>
                          {(categories ?? []).map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setActiveCategory(cat.id);
                                setMobileCategoryMenuOpen(false);
                              }}
                              className={`block w-full px-3.5 py-2.5 text-left text-[13px] font-bold transition ${
                                activeCategory === cat.id
                                  ? "bg-primary/12 text-primary"
                                  : "text-slate-900 hover:bg-black/5 dark:text-slate-100 dark:hover:bg-white/8"
                              }`}
                            >
                              <span className="block truncate">{cat.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileCategoryMenuOpen(false);
                      setMobileSearchOpen(true);
                    }}
                    className="flex h-11 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-white dark:bg-slate-900/80"
                    aria-label="打开搜索"
                  >
                    <span className="material-symbols-outlined text-[20px] text-slate-500">search</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mb-8 hidden md:block">
            <div>
              <h2 className="mb-1 text-2xl font-bold">人气热销与火锅外卖菜单</h2>
              <p className="text-slate-500 dark:text-slate-400">{selectedCategoryName}</p>
            </div>
          </div>

          {/* Product Grid */}
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-background-light transition-all duration-300 hover:shadow-lg dark:border-primary/10 dark:bg-primary/5">
                <div className="flex gap-3 p-3 md:block md:p-0">
                {item.image_url && !brokenImageIds.includes(item.id) ? (
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    width={640}
                    height={320}
                    onError={() => setBrokenImageIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))}
                    className="h-28 w-28 shrink-0 rounded-2xl object-cover transition-transform duration-500 group-hover:scale-105 md:h-40 md:w-full md:rounded-none"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 transition-transform duration-500 group-hover:scale-105 md:h-40 md:w-full md:rounded-none">
                    <span className="material-symbols-outlined text-4xl text-primary/70 md:text-5xl">ramen_dining</span>
                  </div>
                )}
                <div className="min-w-0 flex-1 p-0 md:p-3">
                  <div className="mb-1">
                    <h3 className="line-clamp-3 text-base font-bold leading-snug md:line-clamp-2 md:text-base">{item.name}</h3>
                    {(item.tags ?? []).length > 0 ? (
                      <span className="mt-1 inline-block max-w-full truncate bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded align-top">
                        {item.tags?.[0]}
                      </span>
                    ) : null}
                  </div>
                  <p className="mb-3 line-clamp-3 text-xs text-slate-500 dark:text-slate-400 md:mb-3 md:line-clamp-2">{item.description || "精选单品，现点现做。"}</p>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <span className="text-primary font-bold text-lg md:text-lg">RM {Number(item.base_price).toFixed(2)}</span>
                      {item.option_groups.length > 0 ? (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">可选规格</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {(itemQtyMap.get(item.id) ?? 0) > 0 ? (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">
                          x{itemQtyMap.get(item.id)}
                        </span>
                      ) : null}
                      <BouncyActionButton
                        onClick={() => handleIncrement(item.id)}
                        success={isAddedPulsing(item.id)}
                        icon={<span className="material-symbols-outlined text-xl">add</span>}
                        successIcon={<span className="material-symbols-outlined text-xl">done</span>}
                        className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary/90 shadow-md shadow-primary/20"
                      />
                    </div>
                  </div>
                </div>
                </div>
              </div>
            ))}
            {menuItems === null ? (
              <div className="col-span-full rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] p-6 text-sm text-[color:var(--theme-muted)] backdrop-blur-sm dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface-elevated)] dark:text-slate-300">
                菜单加载中...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] p-6 text-sm text-[color:var(--theme-muted)] backdrop-blur-sm dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface-elevated)] dark:text-slate-300">
                暂无可售单品，请先在后台 /admin/delivery/menu/items 上架。
              </div>
            ) : null}
          </div>

          <section className="mt-8 rounded-2xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mt-10">
            <p className="text-[11px] font-black tracking-[0.14em] text-primary">DELIVERY DEFINITION</p>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              男朋友火锅外卖是品牌的即时消费入口，提供现煮火锅菜品、汤底与配料选择；用户先填写地址取得配送报价，再决定是否付款下单。
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
              <Link href="/shop" className="inline-flex rounded-full border border-primary/15 bg-primary/5 px-3 py-2 text-primary hover:bg-primary/10">
                囤货送礼请看商城
              </Link>
              <Link href="/shop/bundles" className="inline-flex rounded-full border border-primary/15 bg-primary/5 px-3 py-2 text-primary hover:bg-primary/10">
                快速组合看 Bundle Set
              </Link>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mt-10 md:p-5">
            <p className="text-[11px] font-black tracking-[0.14em] text-primary">DELIVERY FAQ</p>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100 md:text-2xl">
              外卖常见问题
            </h2>
            <div className="mt-4 space-y-3">
              {deliveryFaqItems.map((item, index) => (
                <details
                  key={item.question}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
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

        {/* Cart Sidebar */}
        <aside className={`w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-background-light dark:border-primary/10 dark:bg-background-dark lg:sticky lg:top-20 lg:h-[calc(100vh-8.5rem)] ${isCartOpen ? "hidden lg:flex" : "hidden"}`}>
          <div className="p-3 border-b border-slate-200 dark:border-primary/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">我的购物车</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{cartCount} 件商品</span>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="tap-bouncy text-slate-400 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>
            
            {/* Cart Items */}
            <div className="max-h-[32vh] space-y-3 overflow-y-auto pr-1">
              {cartLines.map((line) => {
                const item = itemMap.get(line.itemId);
                return (
                  <div key={line.key} className="flex gap-2.5">
                    {line.imageUrl || item?.image_url ? (
                      <div className="h-12 w-12 rounded-lg shrink-0 bg-cover bg-center" style={{ backgroundImage: `url('${line.imageUrl || item?.image_url || ""}')` }} />
                    ) : (
                      <div className="h-12 w-12 rounded-lg shrink-0 bg-primary/10 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined">ramen_dining</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{buildDeliveryCartItemTitle(line)}</p>
                      {line.selectedOptions.length > 0 ? (
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">{formatDeliveryCartOptionSummary(line.selectedOptions)}</p>
                      ) : null}
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-primary text-xs font-bold">RM {line.unitPrice.toFixed(2)}</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleDecrement(line.key)}
                            className="tap-bouncy w-5 h-5 rounded-full border border-slate-300 dark:border-primary/30 flex items-center justify-center text-xs hover:bg-slate-100"
                          >-</button>
                          <span className="text-xs">{line.quantity}</span>
                          <button 
                            onClick={() => handleIncrementCartLine(line)}
                            className="tap-bouncy w-5 h-5 rounded-full border border-primary bg-primary/10 text-primary flex items-center justify-center text-xs hover:bg-primary/20"
                          >+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Checkout Summary */}
          <div className="mt-auto bg-black/2 p-3 pb-6 dark:bg-primary/5">
            <div className="mb-3 rounded-2xl border border-primary/15 bg-gradient-to-b from-white to-primary/[0.04] p-3 shadow-sm dark:border-primary/20 dark:from-slate-900/70 dark:to-primary/10">
              <button
                type="button"
                onClick={() => setContactCollapsed((prev) => !prev)}
                className="flex w-full items-center justify-between"
              >
                <p className="text-[11px] font-black tracking-[0.16em] text-primary">DELIVERY CONTACT</p>
                <span className="material-symbols-outlined text-primary">{contactCollapsed ? "expand_more" : "expand_less"}</span>
              </button>
              {contactCollapsed ? (
                <p className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-400">
                  {[customerName, customerPhone, dropoffAddress].filter(Boolean).join(" · ") || "点击展开填写配送信息"}
                </p>
              ) : null}
              <div className={`${contactCollapsed ? "hidden" : "mt-3 space-y-2"}`}>
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.12em] text-primary">ADDRESS STATUS</p>
                      <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">
                        {dropoffAddress.trim() ? "已填写送达地址" : "待填写送达地址"}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--theme-muted)]">
                        {dropoffAddress.trim() ? dropoffAddress : "建议输入门牌号、路名、城市，方便系统报价与派送。"}
                      </p>
                    </div>
                    {!useProfileShipping && profileShipping ? (
                      <button type="button" onClick={fillShippingFromProfile} className="rounded-full border border-primary/25 px-3 py-1.5 text-[11px] font-bold text-primary">
                        带入资料
                      </button>
                    ) : null}
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={useProfileShipping}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setUseProfileShipping(checked);
                      if (checked) fillShippingFromProfile();
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>与账户个人信息地址资料相同</span>
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人姓名</p>
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="请输入收货人姓名"
                    readOnly={useProfileShipping}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70"
                  />
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人电话</p>
                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="请输入手机号码"
                    readOnly={useProfileShipping}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70"
                  />
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">送达地址</p>
                  <div className="relative">
                    <input
                      value={dropoffAddress}
                      onFocus={() => {
                        if (addressSuggestions.length > 0 && !useProfileShipping) setAddressSearchOpen(true);
                      }}
                      onBlur={() => {
                        window.setTimeout(() => setAddressSearchOpen(false), 150);
                      }}
                      onChange={(event) => {
                        setDropoffAddress(event.target.value);
                        setDropoffCoordinates(null);
                      }}
                      placeholder="请输入完整送达地址（门牌号/楼层/门铃）"
                      readOnly={useProfileShipping}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70"
                    />
                    {addressSearchOpen ? (
                      <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] p-2 shadow-xl backdrop-blur-sm dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface-elevated)]">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              const merged = [suggestion.label, suggestion.detail].filter(Boolean).join(", ");
                              setDropoffAddress(merged);
                              setDropoffCoordinates({ lat: suggestion.lat, lng: suggestion.lng });
                              setAddressSearchOpen(false);
                              setAddressSuggestions([]);
                              setQuoteError(null);
                            }}
                            className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-black/4 dark:hover:bg-white/6"
                          >
                            <p className="text-[11px] font-bold leading-4 text-slate-900 dark:text-slate-100">{suggestion.label}</p>
                            {suggestion.detail ? <p className="mt-0.5 text-[10px] leading-4 text-slate-500 dark:text-slate-300">{suggestion.detail}</p> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {addressSearching ? <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">正在搜索可选地址...</p> : null}
                  {!addressSearching && dropoffAddress.trim().length >= 6 && addressSuggestions.length === 0 && !useProfileShipping ? (
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">暂无匹配候选，系统会继续尝试直接解析该地址。</p>
                  ) : null}
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">备注 Remark（可选）</p>
                  <input
                    value={deliveryRemark}
                    onChange={(event) => setDeliveryRemark(event.target.value)}
                    placeholder="例：请到门口前先打电话 / 放保安处"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70"
                  />
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">此备注会在创建配送单时传给 Lalamove 订单。</p>
                </label>
                <label className="block rounded-2xl border border-primary/15 bg-primary/5 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.12em] text-primary">COUPONS</p>
                      <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">优惠券</p>
                    </div>
                    <span className="rounded-full border border-primary/20 bg-white/60 px-2.5 py-1 text-[10px] font-bold text-primary dark:bg-slate-900/60">
                      已选 {selectedCouponOptions.length}
                    </span>
                  </div>
                  <MemberCouponDropdown
                    options={userCouponOptions}
                    selectedCodes={selectedCouponCodes}
                    onToggle={(code) => {
                      const option = userCouponOptions.find((item) => item.code === code);
                      if (!option) return;
                      if (selectedCouponCodes.includes(code)) {
                        setSelectedCouponCodes((prev) => prev.filter((item) => item !== code));
                        return;
                      }
                      if (option.disabledReason) return;
                      setSelectedCouponCodes((prev) => [...prev, code]);
                    }}
                    placeholder="选择当前用户可用优惠券"
                  />
                  {selectedCouponOptions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedCouponOptions.map((option) => (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => setSelectedCouponCodes((prev) => prev.filter((code) => code !== option.code))}
                          className="rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-[11px] font-bold text-primary dark:bg-slate-900/60"
                        >
                          {option.title} · -RM {option.discountAmount.toFixed(2)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">不可叠加或不符合条件的优惠券会自动灰暗。可叠加的优惠券可同时选择。</p>
                  )}
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">配送车型</p>
                  <select
                    value={serviceType}
                    onChange={(event) => setServiceType(event.target.value as (typeof QUOTE_SERVICE_TYPES)[number])}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70"
                  >
                    {QUOTE_SERVICE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">不同车型报价会不同，建议按实际配送需求选择。</p>
                </label>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">商品小计</span>
                <span className="font-medium">RM {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">配送费</span>
                <span className="font-medium">{quotationFee === null ? (quoteRefreshing ? "报价中..." : "待报价") : `RM ${deliveryFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">SST 6%</span>
                <span className="font-medium">RM {sst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">优惠券</span>
                <span className="text-green-500">-RM {discount.toFixed(2)}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-primary/10 my-2"></div>
              <div className="flex justify-between items-end">
                <span className="font-bold">总计</span>
                <span className="text-2xl font-bold text-primary">RM {total.toFixed(2)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={submitting || geocoding || quoteRefreshing || quotationFee === null}
              className="tap-bouncy w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined">shopping_bag</span>
              {submitting || geocoding || quoteRefreshing ? "提交中..." : quotationFee === null ? "等待报价..." : "立即结算"}
            </button>
            {quotationId ? (
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                <p className="font-bold text-primary">报价单 {quotationId}</p>
                {quotationServiceType ? <p className="mt-1 text-slate-600 dark:text-slate-300">车型：{quotationServiceType}</p> : null}
                <p className="mt-1 text-slate-600 dark:text-slate-300">有效期倒计时：{quotationRemainingText ?? "-"}</p>
                {quotationTotalText ? <p className="mt-1 text-slate-600 dark:text-slate-300">报价金额：{quotationTotalText}</p> : null}
              </div>
            ) : null}
            {quoteError ? <p className="mt-2 text-xs font-bold text-amber-600">{quoteError}</p> : null}
            {officialOrderId ? (
              <div className="mt-3 rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] px-3 py-2 text-xs backdrop-blur-sm dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface-elevated)]">
                <p className="font-bold">订单号：{officialOrderId}</p>
                <p className="mt-1">配送状态：{deliveryStatusText ?? "待同步"}</p>
                {deliveryOrderId ? <p className="mt-1">配送单号：{deliveryOrderId}</p> : null}
                {deliveryEvents.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {deliveryEvents.slice(-3).map((event) => (
                      <p key={event.id}>{new Date(event.created_at).toLocaleTimeString()} · {event.step}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {checkoutMessage ? <p className="mt-3 text-xs font-bold text-primary">{checkoutMessage}</p> : null}
            <p className="text-[10px] text-center text-slate-400 mt-3 italic">下单即代表同意我们的服务条款</p>
          </div>
        </aside>
      </div>

      {isCartOpen ? (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm lg:hidden" onClick={() => setIsCartOpen(false)}>
          <div className="absolute bottom-[calc(var(--mobile-bottom-nav-height)+var(--safe-area-bottom)+34px)] left-3 right-3 top-[96px] overflow-y-auto rounded-[28px] border border-primary/10 bg-white p-4 shadow-2xl dark:border-primary/15 dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.12em] text-primary">DELIVERY CART</p>
                <h3 className="mt-1 text-lg font-black">购物车与结算</h3>
              </div>
              <button type="button" onClick={() => setIsCartOpen(false)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold dark:border-slate-700">
                关闭
              </button>
            </div>

            <div className="space-y-3">
              {cartLines.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">购物车为空</p>
              ) : (
                cartLines.map((line) => {
                  const item = itemMap.get(line.itemId);
                  return (
                    <div key={line.key} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex gap-3">
                        {line.imageUrl || item?.image_url ? (
                          <div className="h-14 w-14 shrink-0 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url('${line.imageUrl || item?.image_url || ""}')` }} />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <span className="material-symbols-outlined !text-primary">ramen_dining</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{buildDeliveryCartItemTitle(line)}</p>
                          {line.selectedOptions.length > 0 ? (
                            <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{formatDeliveryCartOptionSummary(line.selectedOptions)}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-slate-500">RM {line.unitPrice.toFixed(2)}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button type="button" onClick={() => handleDecrement(line.key)} className="h-7 w-7 rounded-full border border-slate-300 text-xs font-bold dark:border-slate-700">-</button>
                            <span className="w-6 text-center text-xs font-bold">{line.quantity}</span>
                            <button type="button" onClick={() => handleIncrementCartLine(line)} className="h-7 w-7 rounded-full border border-primary bg-primary/10 text-xs font-bold text-primary">+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-3">
              <div className="rounded-2xl border border-primary/15 bg-white/70 p-3 dark:bg-slate-900/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black tracking-[0.12em] text-primary">ADDRESS STATUS</p>
                    <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">
                      {dropoffAddress.trim() ? "已填写送达地址" : "待填写送达地址"}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--theme-muted)]">
                      {dropoffAddress.trim() ? dropoffAddress : "建议填入门牌号、路名、城市，方便报价与派送。"}
                    </p>
                  </div>
                  {!useProfileShipping && profileShipping ? (
                    <button type="button" onClick={fillShippingFromProfile} className="rounded-full border border-primary/25 px-3 py-1.5 text-[11px] font-bold text-primary">
                      带入资料
                    </button>
                  ) : null}
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={useProfileShipping}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setUseProfileShipping(checked);
                    if (checked) fillShippingFromProfile();
                  }}
                  className="h-4 w-4 accent-primary"
                />
                <span>与账户个人信息地址资料相同</span>
              </label>
              <label className="block">
                <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人姓名</p>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} readOnly={useProfileShipping} placeholder="请输入收货人姓名" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
              </label>
              <label className="block">
                <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人电话</p>
                <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} readOnly={useProfileShipping} placeholder="请输入手机号码" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
              </label>
              <label className="block">
                <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">送达地址</p>
                <div className="relative">
                  <input
                    value={dropoffAddress}
                    onFocus={() => {
                      if (addressSuggestions.length > 0 && !useProfileShipping) setAddressSearchOpen(true);
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setAddressSearchOpen(false), 150);
                    }}
                    onChange={(event) => {
                      setDropoffAddress(event.target.value);
                      setDropoffCoordinates(null);
                    }}
                    readOnly={useProfileShipping}
                    placeholder="请输入完整送达地址"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
                  />
                  {addressSearchOpen ? (
                    <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] p-2 shadow-xl backdrop-blur-sm dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface-elevated)]">
                      {addressSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            const merged = [suggestion.label, suggestion.detail].filter(Boolean).join(", ");
                            setDropoffAddress(merged);
                            setDropoffCoordinates({ lat: suggestion.lat, lng: suggestion.lng });
                            setAddressSearchOpen(false);
                            setAddressSuggestions([]);
                            setQuoteError(null);
                          }}
                          className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-black/4 dark:hover:bg-white/6"
                        >
                          <p className="text-[11px] font-bold leading-4 text-slate-900 dark:text-slate-100">{suggestion.label}</p>
                          {suggestion.detail ? <p className="mt-0.5 text-[10px] leading-4 text-slate-500 dark:text-slate-300">{suggestion.detail}</p> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {addressSearching ? <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">正在搜索可选地址...</p> : null}
                {!addressSearching && dropoffAddress.trim().length >= 6 && addressSuggestions.length === 0 && !useProfileShipping ? (
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">暂无匹配候选，系统会继续尝试直接解析该地址。</p>
                ) : null}
              </label>
              <div className="rounded-2xl border border-primary/15 bg-white/70 p-3 dark:bg-slate-900/60">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black tracking-[0.12em] text-primary">COUPONS</p>
                    <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">优惠券</p>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-bold text-primary">
                    已选 {selectedCouponOptions.length}
                  </span>
                </div>
                <MemberCouponDropdown
                  options={userCouponOptions}
                  selectedCodes={selectedCouponCodes}
                  onToggle={(code) => {
                    const option = userCouponOptions.find((item) => item.code === code);
                    if (!option) return;
                    if (selectedCouponCodes.includes(code)) {
                      setSelectedCouponCodes((prev) => prev.filter((item) => item !== code));
                      return;
                    }
                    if (option.disabledReason) return;
                    setSelectedCouponCodes((prev) => [...prev, code]);
                  }}
                  placeholder="选择当前用户可用优惠券"
                />
                {selectedCouponOptions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCouponOptions.map((option) => (
                      <button
                        key={option.code}
                        type="button"
                        onClick={() => setSelectedCouponCodes((prev) => prev.filter((code) => code !== option.code))}
                        className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-bold text-primary"
                      >
                        {option.title} · -RM {option.discountAmount.toFixed(2)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">不可叠加或不符合条件的优惠券会自动灰暗。可叠加优惠券可同时选择。</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-black/3 p-3 text-sm dark:bg-white/5">
                <div>
                  <p className="text-[11px] text-slate-500">商品小计</p>
                  <p className="mt-1 font-bold">RM {subtotal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">配送费</p>
                  <p className="mt-1 font-bold">{quotationFee === null ? "待报价" : `RM ${deliveryFee.toFixed(2)}`}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">SST</p>
                  <p className="mt-1 font-bold">RM {sst.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">优惠券</p>
                  <p className="mt-1 font-bold text-emerald-500">-RM {discount.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-slate-500">总计</p>
                  <p className="text-xl font-black text-primary">RM {total.toFixed(2)}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting || geocoding || quoteRefreshing || quotationFee === null}
                  className="tap-bouncy rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {submitting || geocoding || quoteRefreshing ? "提交中..." : quotationFee === null ? "等待报价..." : "立即结算"}
                </button>
              </div>
              {checkoutMessage ? <p className="text-xs font-bold text-primary">{checkoutMessage}</p> : null}
              {quoteError ? <p className="text-xs font-bold text-amber-600">{quoteError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {cartCount > 0 && !isCartOpen ? (
        <div className="mobile-sticky-action-bar md:hidden">
          <div className="mobile-sticky-action-bar__inner">
            <button type="button" onClick={() => router.push("/delivery/checkout")} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <span className="material-symbols-outlined !text-primary">shopping_cart</span>
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-black text-[color:var(--foreground)]">{cartCount} 份菜品</p>
                <p className="text-xs text-[color:var(--theme-muted)]">合计 RM {total.toFixed(2)}</p>
              </div>
            </button>
            <button type="button" onClick={() => router.push("/delivery/checkout")} className="tap-bouncy shrink-0 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white shadow-lg shadow-primary/25">
              去结算
            </button>
          </div>
        </div>
      ) : null}

      <div className="hidden md:block">
        <Footer />
      </div>
      <div aria-hidden className="mobile-page-bottom-space md:hidden" />
      <UnifiedModal
        open={Boolean(optionModalItem)}
        title={optionModalItem?.name ?? "选择规格"}
        description="请选择这份单品的规格与加料选项。"
        badge="规格"
        size="lg"
        onClose={closeOptionModal}
        actions={
          <>
            <button type="button" onClick={closeOptionModal} className="rounded-lg border border-[color:var(--theme-border-strong)] px-4 py-2 text-sm font-bold text-[color:var(--foreground)] hover:bg-black/4 dark:hover:bg-white/6">
              取消
            </button>
            <button type="button" onClick={confirmOptionSelection} className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90">
              加入购物车 · RM {optionModalUnitPrice.toFixed(2)}
            </button>
          </>
        }
      >
        {optionModalItem ? (
          <>
            <div className="rounded-[28px] border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/80">Complete your set</p>
                  <p className="mt-2 text-lg font-black text-[color:var(--foreground)] sm:text-xl">{optionModalItem.name}</p>
                  <p className="mt-1 text-sm text-[color:var(--theme-muted)]">{optionModalItem.description || "请选择适合你的规格组合。"}</p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Base Price</p>
                    <p className="text-lg font-black text-primary">RM {Number(optionModalItem.base_price).toFixed(2)}</p>
                  </div>
                  <div className="rounded-full border border-primary/20 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-primary dark:bg-slate-900/60">
                    Customize
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {optionModalItem.option_groups.map((group) => {
                const selectedIds = optionSelections[group.id] ?? [];
                const minSelect = Math.max(group.required ? 1 : 0, Number(group.min_select ?? 0));
                const maxSelect = Math.max(Number(group.max_select ?? 0), minSelect);
                const isSingleChoice = maxSelect <= 1;
                return (
                  <section key={group.id} className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-950/40 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-black text-[color:var(--foreground)]">{group.name}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {isSingleChoice ? "单选" : `最多 ${maxSelect} 选`} / {minSelect > 0 ? `至少 ${minSelect} 选` : "可不选"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary">
                          {selectedIds.length}/{maxSelect}
                        </span>
                        {group.required ? <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-rose-600">必选</span> : null}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {(group.official_menu_option_options ?? []).map((option) => {
                        const checked = selectedIds.includes(option.id);
                        const visualLabel = buildOptionVisualLabel(option.name);
                        const optionImageKey = `option:${option.id}`;
                        const optionImage = optionImageByName.get(normalizeOptionLookupName(option.name));
                        const showOptionImage = Boolean(optionImage?.src) && !brokenImageIds.includes(optionImageKey);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleOptionSelection(group, option.id)}
                            className={`group relative overflow-hidden rounded-[24px] border p-3 text-left transition sm:p-4 ${
                              checked
                                ? "border-primary bg-primary/[0.14] ring-2 ring-[#ff6aa9]/55 shadow-[0_0_0_1px_rgba(255,106,169,0.55),0_0_24px_rgba(255,90,150,0.22),0_18px_36px_rgba(190,24,93,0.2)]"
                                : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900/60"
                            }`}
                          >
                            <div
                              className={`overflow-hidden rounded-[18px] border bg-white/80 shadow-[0_14px_30px_rgba(127,29,29,0.12)] transition group-hover:scale-[1.01] dark:bg-slate-950/40 ${
                                checked ? "border-primary/40" : "border-primary/10 dark:border-primary/20"
                              }`}
                            >
                              {showOptionImage && optionImage ? (
                                <Image
                                  src={optionImage.src}
                                  alt={optionImage.alt}
                                  width={320}
                                  height={180}
                                  className="h-28 w-full object-cover"
                                  onError={() =>
                                    setBrokenImageIds((prev) => (prev.includes(optionImageKey) ? prev : [...prev, optionImageKey]))
                                  }
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-28 w-full items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(254,226,226,0.86)_46%,rgba(153,27,27,0.2)_100%)] text-center">
                                  <span className="px-3 text-sm font-black tracking-wide text-rose-900">{visualLabel}</span>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 flex items-start justify-between gap-2">
                              <div>
                                <p className="line-clamp-3 min-h-[4.5rem] text-sm font-bold leading-snug text-[color:var(--foreground)]">{option.name}</p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                                  checked
                                    ? "border-primary/30 bg-primary/10 text-primary"
                                    : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/80"
                                }`}
                              >
                                {checked ? "已选" : isSingleChoice ? "单选" : "可加"}
                              </span>
                            </div>
                            <div className="mt-4 flex items-end justify-between gap-2">
                              <span className="text-lg font-black text-[color:var(--foreground)]">RM {Number(option.price_delta ?? 0).toFixed(2)}</span>
                              <span className={`text-[11px] font-black uppercase tracking-[0.12em] ${checked ? "text-primary" : "text-slate-400"}`}>
                                {checked ? "已选" : isSingleChoice ? "选择" : "添加"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
            <div className="rounded-[24px] border border-primary/15 bg-white/90 p-4 text-sm shadow-[0_16px_32px_rgba(15,23,42,0.05)] dark:bg-slate-900/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-[color:var(--foreground)]">已选规格</p>
                  <p className="mt-1 text-xs leading-relaxed text-[color:var(--theme-muted)]">
                    {selectedModalOptions.length > 0 ? formatDeliveryCartOptionSummary(selectedModalOptions) : "暂未选择额外规格"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Total</p>
                  <p className="text-xl font-black text-primary">RM {optionModalUnitPrice.toFixed(2)}</p>
                </div>
              </div>
            </div>
            {optionError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30">{optionError}</div> : null}
          </>
        ) : null}
      </UnifiedModal>
      <UnifiedModal
        open={authPromptOpen}
        title="先登录再下单"
        description="登录/注册后下单可累计会员积分，并参与推荐返利活动。"
        badge="会员权益"
        size="md"
        onClose={() => setAuthPromptOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setAuthPromptOpen(false)} className="rounded-lg border border-[color:var(--theme-border-strong)] px-4 py-2 text-sm font-bold text-[color:var(--foreground)] hover:bg-black/4 dark:hover:bg-white/6">
              稍后再说
            </button>
            <Link href="/login" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/10" onClick={() => setAuthPromptOpen(false)}>
              去登录
            </Link>
            <Link href="/register" className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90" onClick={() => setAuthPromptOpen(false)}>
              去注册
            </Link>
          </>
        }
      >
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
          会员可在商城、外卖与门店扫码消费累计积分，后续可兑换优惠券。
        </div>
      </UnifiedModal>
    </div>
  );
}
