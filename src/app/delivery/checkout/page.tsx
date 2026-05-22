"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { UnifiedModal } from "@/components/unified-modal";
import { MemberCouponDropdown, type MemberCouponDropdownOption } from "@/components/member-coupon-dropdown";
import {
  buildDeliveryCartItemTitle,
  countDeliveryCartItems,
  formatDeliveryCartOptionSummary,
  readDeliveryCart,
  removeDeliveryCartItem,
  setDeliveryCartItemQuantity,
  type DeliveryCartState,
} from "@/lib/delivery-cart";
import {
  fetchOfficialMenuItems,
  type OfficialMenuItem,
} from "@/lib/admin/official-delivery";
import { supabase } from "@/lib/supabase";
import { requestDeliveryQuote } from "@/lib/delivery/lalamove";
import { createPayexIntent, fetchPayexPaymentStatus } from "@/lib/payments/payex";

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

export default function DeliveryCheckoutPage() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<OfficialMenuItem[] | null>(null);
  const [cart, setCart] = useState<DeliveryCartState>({ items: [] });
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
  const [useProfileShipping, setUseProfileShipping] = useState(false);
  const [profileShipping, setProfileShipping] = useState<{ name: string; phone: string; address: string } | null>(null);
  const [dropoffCoordinates, setDropoffCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
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

  useEffect(() => {
    let active = true;
    fetchOfficialMenuItems("ala_carte").then((items) => {
      if (!active) return;
      setMenuItems(items.filter((x) => x.is_active));
    });
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

  const itemMap = useMemo(() => {
    return new Map((menuItems ?? []).map((item) => [item.id, item]));
  }, [menuItems]);

  const cartItems = useMemo(() => {
    return cart.items
      .filter((line) => line.quantity > 0)
      .map((line) => ({
        line,
        item: itemMap.get(line.itemId) ?? null,
      }));
  }, [cart, itemMap]);

  const cartCount = countDeliveryCartItems(cart);
  const subtotal = cartItems.reduce((acc, entry) => acc + entry.line.unitPrice * entry.line.quantity, 0);
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

  const quotationRemainingText = useMemo(() => {
    if (!quotationExpiresAt) return null;
    const remainMs = new Date(quotationExpiresAt).getTime() - nowTs;
    if (remainMs <= 0) return "报价已过期";
    const totalSec = Math.floor(remainMs / 1000);
    const mm = Math.floor(totalSec / 60).toString().padStart(2, "0");
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
      if (paymentStatus === "succeeded") setCheckoutMessage("支付成功，系统正在创建配送单");
      else if (paymentStatus === "failed") setCheckoutMessage("支付失败，请重试");
      else setCheckoutMessage("支付处理中，请稍后刷新状态");
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  const searchAddressSuggestions = useCallback(async (address: string): Promise<AddressSuggestion[]> => {
    const run = async (query: string) => {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=my&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`);
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
          return { label, detail: rest.join(", "), lat, lng } satisfies AddressSuggestion;
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
    if (cleaned.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
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
          { address: PICKUP_POINT.address, coordinates: PICKUP_POINT.coordinates },
          { address: dropoff.address, coordinates: dropoff.coordinates },
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
      const quoteRaw = await requestQuote({ address: dropoffAddress, coordinates: resolvedCoordinates });
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
  }, [cartCount, dropoffAddress, geocodeAddress, requestQuote]);

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
    const client = supabase;
    if (!officialOrderId || !client) return;
    let active = true;
    const run = async () => {
      const { data, error } = await client.functions.invoke("checkout-delivery", { body: { action: "status", officialOrderId } });
      if (!active || error) return;
      const payload = (data as { data?: { delivery?: { status?: string; lalamove_order_id?: string | null }; events?: Array<{ id: string; step: string; created_at: string }>; payment?: { status?: string } } })?.data;
      if (payload?.delivery) {
        setDeliveryStatus(payload.delivery.status ?? null);
        setDeliveryOrderId(payload.delivery.lalamove_order_id ?? null);
        setDeliveryEvents(payload.events ?? []);
        if (payload.delivery.lalamove_order_id) setCheckoutMessage("下单成功：支付完成且配送单已创建");
        return;
      }
      const paymentStatus = payload?.payment?.status ?? "";
      if (paymentStatus === "succeeded") setCheckoutMessage("支付已确认，系统正在分配骑手");
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

      const quoteRaw = await requestQuote({ address: dropoffAddress, coordinates: resolvedCoordinates });
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

      const payloadCartItems = cartItems.map(({ line }) => ({
        id: line.itemId,
        title: buildDeliveryCartItemTitle(line),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        selectedOptions: line.selectedOptions.map((option) => ({
          groupId: option.groupId,
          optionId: option.optionId,
        })),
      }));

      const { data: checkoutDataRaw, error: checkoutError } = await supabase.functions.invoke("checkout-delivery", {
        body: {
          action: "checkout",
          currency: "MYR",
          quotationId: parsedQuote.quotationId,
          cartItems: payloadCartItems,
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

      const checkoutData = (checkoutDataRaw as { data?: { officialOrderId?: string; outletId?: string | null; paymentReference?: string } } | null)?.data;
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
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light font-display text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <Navbar cartCount={cartCount} onCartClick={() => void 0} />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-3 py-4 md:px-4 md:py-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm md:flex-row md:items-end md:justify-between md:p-5">
          <div>
            <p className="text-[11px] font-black tracking-[0.14em] text-primary">DELIVERY CHECKOUT</p>
            <h1 className="mt-2 text-2xl font-black">外卖结算</h1>
            <p className="mt-1 text-sm text-[color:var(--theme-muted)]">统一整页式下单，商品、地址、报价和支付都在同一条清晰流程里完成。</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push("/delivery")} className="rounded-2xl border border-primary/15 px-4 py-3 text-sm font-bold text-[color:var(--foreground)]">
              返回外卖
            </button>
            <div className="rounded-2xl bg-primary/8 px-4 py-3 text-sm font-black text-primary">{cartCount} 份菜品</div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-4">
            <div className="rounded-3xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black tracking-[0.14em] text-primary">ITEMS</p>
                  <h2 className="mt-1 text-lg font-black">外卖购物车</h2>
                </div>
              </div>
              <div className="space-y-3">
                {cartItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    购物车为空，先去外卖页加入你想吃的火锅。
                  </div>
                ) : (
                  cartItems.map(({ line, item }) => (
                    <div key={line.key} className="rounded-2xl border border-primary/10 bg-black/3 p-3 dark:bg-white/3">
                      <div className="flex gap-3">
                        {line.imageUrl || item?.image_url ? (
                          <div className="h-20 w-20 shrink-0 rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url('${line.imageUrl || item?.image_url || ""}')` }} />
                        ) : (
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <span className="material-symbols-outlined">ramen_dining</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-black">{buildDeliveryCartItemTitle(line)}</p>
                              {line.selectedOptions.length > 0 ? (
                                <p className="mt-1 line-clamp-2 text-xs text-[color:var(--theme-muted)]">{formatDeliveryCartOptionSummary(line.selectedOptions)}</p>
                              ) : null}
                              <p className="mt-1 text-xs text-[color:var(--theme-muted)]">单价 RM {line.unitPrice.toFixed(2)}</p>
                            </div>
                            <button type="button" onClick={() => removeDeliveryCartItem(line.key)} className="text-xs font-bold text-rose-600">
                              移除
                            </button>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => setDeliveryCartItemQuantity(line.key, Math.max(0, line.quantity - 1))} className="h-8 w-8 rounded-full border border-primary/25 text-sm font-bold text-primary">
                                -
                              </button>
                              <span className="w-8 text-center text-sm font-black">{line.quantity}</span>
                              <button type="button" onClick={() => setDeliveryCartItemQuantity(line.key, line.quantity + 1)} className="h-8 w-8 rounded-full border border-primary/25 text-sm font-bold text-primary">
                                +
                              </button>
                            </div>
                            <p className="text-base font-black text-primary">RM {(line.unitPrice * line.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black tracking-[0.14em] text-primary">CONTACT</p>
                  <h2 className="mt-1 text-lg font-black">配送资料</h2>
                </div>
                {!useProfileShipping && profileShipping ? (
                  <button type="button" onClick={fillShippingFromProfile} className="rounded-full border border-primary/25 px-3 py-1.5 text-[11px] font-bold text-primary">
                    带入资料
                  </button>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                  <p className="text-[11px] font-black tracking-[0.12em] text-primary">ADDRESS STATUS</p>
                  <p className="mt-1 text-sm font-bold">{dropoffAddress.trim() ? "已填写送达地址" : "待填写送达地址"}</p>
                  <p className="mt-1 text-xs text-[color:var(--theme-muted)]">
                    {dropoffAddress.trim() ? dropoffAddress : "建议填入门牌号、路名、城市，方便报价与派送。"}
                  </p>
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

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人姓名</p>
                    <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="请输入收货人姓名" readOnly={useProfileShipping} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                  </label>
                  <label className="block">
                    <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人电话</p>
                    <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="请输入手机号码" readOnly={useProfileShipping} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                  </label>
                </div>

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
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-900/70"
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
                  <input value={deliveryRemark} onChange={(event) => setDeliveryRemark(event.target.value)} placeholder="例：请到门口前先打电话 / 放保安处" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">此备注会在创建配送单时传给 Lalamove 订单。</p>
                </label>

                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">配送车型</p>
                  <select value={serviceType} onChange={(event) => setServiceType(event.target.value as (typeof QUOTE_SERVICE_TYPES)[number])} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-900/70">
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
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black tracking-[0.14em] text-primary">COUPONS</p>
                  <h2 className="mt-1 text-lg font-black">优惠券</h2>
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
                <div className="mt-3 flex flex-wrap gap-2">
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
                <p className="mt-3 text-[11px] text-[color:var(--theme-muted)]">不可叠加或不符合条件的优惠券会自动灰暗，可叠加优惠券可同时选择。</p>
              )}
            </div>

            <div className="rounded-3xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm">
              <p className="text-[11px] font-black tracking-[0.14em] text-primary">QUOTE & SUMMARY</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--theme-muted)]">商品小计</span>
                  <span className="font-bold">RM {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--theme-muted)]">配送费</span>
                  <span className="font-bold">{quotationFee === null ? (quoteRefreshing ? "报价中..." : "待报价") : `RM ${deliveryFee.toFixed(2)}`}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--theme-muted)]">SST 6%</span>
                  <span className="font-bold">RM {sst.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--theme-muted)]">优惠券</span>
                  <span className="font-bold text-primary">-RM {discount.toFixed(2)}</span>
                </div>
                <div className="h-px bg-[color:var(--theme-border)]" />
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] text-[color:var(--theme-muted)]">总计</p>
                    <p className="text-2xl font-black text-primary">RM {total.toFixed(2)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={submitting || geocoding || quoteRefreshing || quotationFee === null}
                    className="rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting || geocoding || quoteRefreshing ? "提交中..." : quotationFee === null ? "等待报价..." : "立即支付"}
                  </button>
                </div>

                {quotationId ? (
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 px-3 py-3 text-xs">
                    <p className="font-bold text-primary">报价单 {quotationId}</p>
                    {quotationServiceType ? <p className="mt-1 text-slate-600 dark:text-slate-300">车型：{quotationServiceType}</p> : null}
                    <p className="mt-1 text-slate-600 dark:text-slate-300">有效期倒计时：{quotationRemainingText ?? "-"}</p>
                    {quotationTotalText ? <p className="mt-1 text-slate-600 dark:text-slate-300">报价金额：{quotationTotalText}</p> : null}
                  </div>
                ) : null}
                {quoteError ? <p className="text-xs font-bold text-amber-600">{quoteError}</p> : null}
                {officialOrderId ? (
                  <div className="rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] px-3 py-3 text-xs backdrop-blur-sm">
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
                {checkoutMessage ? <p className="text-xs font-bold text-primary">{checkoutMessage}</p> : null}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div className="hidden md:block">
        <Footer />
      </div>

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
