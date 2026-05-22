"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { BouncyActionButton } from "@/components/bouncy-action-button";
import {
  fetchOfficialBundles,
  fetchOfficialShopBanners,
  fetchOfficialShopShippingRates,
  fetchOfficialSoupPackVariants,
  type OfficialBundle,
  type OfficialShopBanner,
  type OfficialShopShippingRate,
  type OfficialSoupPackVariant,
} from "@/lib/admin/official-shop";
import { addItem, countItems, readCartState, removeCartItem, writeCartState, type CartState } from "@/lib/shop-cart";
import { fetchActivePromotionsPublic, type OfficialPromotion } from "@/lib/admin/official-platform";
import { useSuccessPulse } from "@/hooks/use-success-pulse";
import { createPayexIntent } from "@/lib/payments/payex";
import { assetPath } from "@/lib/site-config";
import { supabase } from "@/lib/supabase";
import { UnifiedModal } from "@/components/unified-modal";
import { MemberCouponDropdown, type MemberCouponDropdownOption } from "@/components/member-coupon-dropdown";

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

function mergeImages(primary: string | null | undefined, extra: string[] | undefined) {
  const out: string[] = [];
  const push = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    if (!s) return;
    if (!out.includes(s)) out.push(s);
  };
  push(primary ?? undefined);
  for (const v of extra ?? []) push(v);
  if (out.length === 0) out.push(assetPath("/logo.png"));
  return out;
}

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

function HoverCarouselImage({ images, alt }: { images: string[]; alt: string }) {
  const [hovering, setHovering] = useState(false);
  const [index, setIndex] = useState(0);
  const activeIndex = images.length > 0 ? index % images.length : 0;

  useEffect(() => {
    if (!hovering || images.length <= 1) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % images.length), 800);
    return () => window.clearInterval(timer);
  }, [hovering, images.length]);

  return (
    <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-white/5" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <Image
        src={images[activeIndex] ?? assetPath("/logo.png")}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </div>
  );
}

export default function ShopPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<"bundle" | "ala_carte">("ala_carte");
  const [currency, setCurrency] = useState<"MYR" | "SGD">("MYR");
  const [rows, setRows] = useState<OfficialSoupPackVariant[] | null>(null);
  const [bundles, setBundles] = useState<OfficialBundle[] | null>(null);
  const [banners, setBanners] = useState<OfficialShopBanner[] | null>(null);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [cartState, setCartState] = useState<CartState>({ version: 2, items: [] });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<OfficialPromotion[] | null>(null);
  const [shippingRates, setShippingRates] = useState<OfficialShopShippingRate[] | null>(null);
  const [couponEvaluationTime] = useState(() => Date.now());
  const [promoIndex, setPromoIndex] = useState(0);
  const [shipName, setShipName] = useState("");
  const [shipPhone, setShipPhone] = useState("");
  const [shipAddress, setShipAddress] = useState("");
  const [shipPostcode, setShipPostcode] = useState("");
  const [userCoupons, setUserCoupons] = useState<UserCouponOption[]>([]);
  const [selectedCouponCodes, setSelectedCouponCodes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [useProfileShipping, setUseProfileShipping] = useState(false);
  const [profileShipping, setProfileShipping] = useState<{ name: string; phone: string; address: string; postcode: string } | null>(null);
  const bundleRef = useRef<HTMLDivElement | null>(null);
  const alaRef = useRef<HTMLDivElement | null>(null);
  const { trigger: triggerAddedPulse, isActive: isAddedPulsing } = useSuccessPulse(700);

  useEffect(() => {
    let active = true;
    Promise.all([fetchOfficialSoupPackVariants(), fetchOfficialBundles(), fetchOfficialShopBanners(), fetchActivePromotionsPublic("shop"), fetchOfficialShopShippingRates()]).then(
      ([variants, bundlesData, bannersData, promotionsData, shippingRatesData]) => {
        if (!active) return;
        setRows(variants.filter((v) => v.status === "active"));
        setBundles(bundlesData.filter((b) => b.status === "active"));
        setBanners(bannersData);
        setPromotions(promotionsData);
        setShippingRates(shippingRatesData);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const timer = window.setInterval(() => setBannerIndex((i) => (i + 1) % banners.length), 4500);
    return () => window.clearInterval(timer);
  }, [banners]);

  useEffect(() => {
    if (!promotions || promotions.length <= 1) return;
    const timer = window.setInterval(() => setPromoIndex((i) => (i + 1) % promotions.length), 3500);
    return () => window.clearInterval(timer);
  }, [promotions]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let active = true;
    const loadProfileShipping = async () => {
      const client = supabase;
      if (!client) return;
      const sessionRes = await client.auth.getSession();
      const userId = sessionRes.data.session?.user?.id;
      if (!active) return;
      setIsAuthed(Boolean(userId));
      if (!active || !userId) return;
      const profileRes = await client
        .from("official_profiles")
        .select("full_name,phone,address")
        .eq("id", userId)
        .maybeSingle();
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
        postcode: parsed.postcode,
      });
      if (!couponRes.error) setUserCoupons((couponRes.data ?? []) as UserCouponOption[]);
    };
    void loadProfileShipping();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session?.user?.id));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const sync = () => {
      setCartCount(countItems());
      setCartState(readCartState());
    };
    sync();
    window.addEventListener("shop:cart:change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("shop:cart:change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const products = useMemo(() => {
    return (rows ?? []).map((v) => ({
      id: String(v.id),
      name: v.title,
      desc: v.subtitle ?? "",
      price: Number(v.prices[currency] ?? 0),
      myrPrice: Number(v.prices.MYR ?? 0),
      tag: v.tags?.[0] ?? "",
      tagColor: "bg-primary",
      images: mergeImages(v.image_url, v.images),
      imageUrl: v.image_url ?? assetPath("/logo.png"),
    }));
  }, [currency, rows]);

  const activeBannerIndex = banners && banners.length > 0 ? bannerIndex % banners.length : 0;
  const activePromoIndex = promotions && promotions.length > 0 ? promoIndex % promotions.length : 0;
  const activeBanner = banners?.[activeBannerIndex] ?? null;

  const activePromotion = useMemo(() => {
    if (!promotions || promotions.length === 0) return null;
    return promotions[activePromoIndex] ?? promotions[0];
  }, [activePromoIndex, promotions]);

  const cartItems = useMemo(() => {
    const variantMap = new Map((rows ?? []).map((variant) => [String(variant.id), variant]));
    const bundleMap = new Map((bundles ?? []).map((bundle) => [String(bundle.id), bundle]));
    return cartState.items.map((item) => {
      if (item.kind === "bundle") {
        const bundle = bundleMap.get(item.bundleId);
        return {
          key: item.id,
          id: item.id,
          kind: item.kind,
          title: bundle?.title ?? `Bundle ${item.bundleId.slice(0, 6)}`,
          image: bundle?.image_url ?? assetPath("/logo.png"),
          qty: item.qty,
          price: Number(currency === "SGD" ? (bundle?.sgd_price ?? 0) : (bundle?.myr_price ?? 0)),
        };
      }
      const variant = variantMap.get(String(item.id));
      return {
        key: item.id,
        id: item.id,
        kind: item.kind,
        title: variant?.title ?? `商品 ${item.id.slice(0, 6)}`,
        image: variant?.image_url ?? assetPath("/logo.png"),
        qty: item.qty,
        price: Number(variant?.prices?.[currency] ?? 0),
      };
    });
  }, [bundles, cartState.items, currency, rows]);

  const cartSubtotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.qty, 0), [cartItems]);
  const shippingCountry = currency === "SGD" ? "SG" : "MY";
  const currencyPrefix = currency === "SGD" ? "S$" : "RM";
  const shopFaqItems = [
    {
      question: "男朋友火锅商城卖什么？",
      answer: "商城主要销售可在家加热食用的花胶汤包、火锅汤底与 Bundle Set，适合家庭备餐、送礼与日常补货。",
    },
    {
      question: "什么时候该选商城，而不是火锅外卖？",
      answer: "如果你要购买可囤货、可冷冻保存、适合自己加热的商品，应选商城；如果你要现煮火锅、配料和即点即送服务，应改到火锅外卖页面。",
    },
    {
      question: "商城下单前要确认哪些信息？",
      answer: "建议先确认商品类型、币种价格、收货地址与配送费用；若想减少选择时间，可直接浏览 Bundle Set 页面挑选组合。",
    },
  ];
  const shippingFee = useMemo(() => {
    const found = (shippingRates ?? []).find((rate) => rate.currency === currency && rate.country === shippingCountry && rate.is_active);
    return Number(found?.fee ?? 0);
  }, [currency, shippingCountry, shippingRates]);
  const baseUserCouponOptions = useMemo<
    Array<
      MemberCouponDropdownOption & {
        stackable: boolean;
        disabledReason: string | null;
        discountAmount: number;
      }
    >
  >(() => {
    return userCoupons.map((coupon) => {
      const template = coupon.official_coupon_templates;
      let disabledReason: string | null = null;
      if (coupon.status !== "issued") disabledReason = "当前状态不可使用";
      else if (coupon.reserved_order_id) disabledReason = "已被其他订单占用";
      else if (coupon.expires_at && new Date(coupon.expires_at).getTime() < couponEvaluationTime) disabledReason = "优惠券已过期";
      else if (!template || template.status !== "enabled") disabledReason = "优惠券模板不可用";
      else if (template.starts_at && new Date(template.starts_at).getTime() > couponEvaluationTime) disabledReason = "尚未生效";
      else if (template.ends_at && new Date(template.ends_at).getTime() < couponEvaluationTime) disabledReason = "模板已过期";
      else if ((template.applies_channels ?? []).length > 0 && !(template.applies_channels ?? []).includes("shop")) disabledReason = "不可用于商城";
      else {
        const minSpend = Number(currency === "SGD" ? template.min_spend_sgd ?? 0 : template.min_spend_myr ?? 0);
        if (cartSubtotal < minSpend) disabledReason = `未达到最低消费 ${currencyPrefix} ${minSpend.toFixed(2)}`;
      }

      let discountAmount = 0;
      if (template?.discount_type === "percent") discountAmount = cartSubtotal * (Number(template.percent_off ?? 0) / 100);
      else discountAmount = Number(currency === "SGD" ? template?.amount_off_sgd ?? 0 : template?.amount_off_myr ?? 0);
      discountAmount = Math.max(0, Math.min(cartSubtotal, Number(discountAmount.toFixed(2))));

      const valueLabel =
        template?.discount_type === "percent"
          ? `${Number(template.percent_off ?? 0).toFixed(0)}% OFF`
          : `${currencyPrefix} ${discountAmount.toFixed(2)}`;

      return {
        code: coupon.coupon_instance_code,
        title: template?.title?.trim() || "优惠券",
        templateCode: template?.code?.trim() || coupon.coupon_instance_code,
        valueLabel,
        expiresAt: coupon.expires_at,
        stackable: Boolean(template?.stackable),
        disabledReason,
        discountAmount,
      };
    });
  }, [cartSubtotal, couponEvaluationTime, currency, currencyPrefix, userCoupons]);

  const selectedCouponLookup = useMemo(() => new Map(baseUserCouponOptions.map((option) => [option.code, option])), [baseUserCouponOptions]);

  const validSelectedCouponCodes = useMemo(() => {
    const nextSelected: string[] = [];
    let hasNonStackable = false;
    for (const code of selectedCouponCodes) {
      const option = selectedCouponLookup.get(code);
      if (!option || option.disabledReason) continue;
      if (hasNonStackable) continue;
      if (!option.stackable && nextSelected.length > 0) continue;
      nextSelected.push(code);
      if (!option.stackable) hasNonStackable = true;
    }
    return nextSelected;
  }, [selectedCouponCodes, selectedCouponLookup]);

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
    const selectedSet = new Set(validSelectedCouponCodes);
    const hasSelectedNonStackable = validSelectedCouponCodes.some((code) => !selectedCouponLookup.get(code)?.stackable);
    return baseUserCouponOptions.map((option) => {
      const selected = selectedSet.has(option.code);
      let disabledReason = option.disabledReason;
      if (!selected && !disabledReason) {
        if (hasSelectedNonStackable) disabledReason = "已选择不可叠加优惠券";
        else if (!option.stackable && validSelectedCouponCodes.length > 0) disabledReason = "该优惠券不可与其他券叠加";
      }
      return {
        ...option,
        selected,
        disabledReason,
      };
    });
  }, [baseUserCouponOptions, validSelectedCouponCodes, selectedCouponLookup]);

  const discountTotal = useMemo(() => {
    let remaining = cartSubtotal;
    let totalDiscount = 0;
    for (const code of validSelectedCouponCodes) {
      const option = selectedCouponLookup.get(code);
      if (!option) continue;
      const nextDiscount = Math.min(remaining, option.discountAmount);
      remaining = Math.max(0, Number((remaining - nextDiscount).toFixed(2)));
      totalDiscount = Number((totalDiscount + nextDiscount).toFixed(2));
    }
    return totalDiscount;
  }, [cartSubtotal, validSelectedCouponCodes, selectedCouponLookup]);
  const cartTotal = cartSubtotal + shippingFee - discountTotal;
  const selectedCouponOptions = useMemo(
    () => userCouponOptions.filter((option) => option.selected && !option.disabledReason),
    [userCouponOptions],
  );

  const changeCartQty = (id: string, nextQty: number) => {
    const nextItems = readCartState().items
      .map((item) => {
        if (item.id !== id) return item;
        return { ...item, qty: Math.max(0, Math.floor(nextQty)) };
      })
      .filter((item) => item.qty > 0);
    writeCartState({ version: 2, items: nextItems });
  };

  const clearCart = () => {
    writeCartState({ version: 2, items: [] });
    setCheckoutMessage(null);
  };

  const applyProfileShipping = useCallback(() => {
    if (!profileShipping) {
      setCheckoutMessage("未找到个人信息地址资料，请先到个人信息页完善");
      setUseProfileShipping(false);
      return;
    }
    setShipName(profileShipping.name);
    setShipPhone(profileShipping.phone);
    setShipAddress(profileShipping.address);
    setShipPostcode(profileShipping.postcode);
    setCheckoutMessage(null);
  }, [profileShipping]);

  const handleProfileShippingToggle = useCallback(
    (checked: boolean) => {
      setUseProfileShipping(checked);
      if (!checked) {
        setCheckoutMessage(null);
        return;
      }
      applyProfileShipping();
    },
    [applyProfileShipping],
  );

  const toggleCouponCode = useCallback(
    (code: string) => {
      const option = userCouponOptions.find((item) => item.code === code);
      if (!option) return;
      if (validSelectedCouponCodes.includes(code)) {
        setSelectedCouponCodes(validSelectedCouponCodes.filter((item) => item !== code));
        return;
      }
      if (option.disabledReason) return;
      setSelectedCouponCodes([...validSelectedCouponCodes, code]);
    },
    [userCouponOptions, validSelectedCouponCodes],
  );

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
    if (cartItems.length === 0) {
      setCheckoutMessage("请先添加商品");
      return;
    }
    if (!shipName.trim() || !shipPhone.trim() || !shipAddress.trim()) {
      setCheckoutMessage("请先填写收货信息");
      return;
    }
    setSubmitting(true);
    setCheckoutMessage(null);
    try {
      const { data: checkoutDataRaw, error: checkoutError } = await supabase.functions.invoke("checkout-shop", {
        body: {
          action: "checkout",
          currency,
          cart: { items: readCartState().items },
          shipping: {
            full_name: shipName.trim(),
            phone: shipPhone.trim(),
            address: shipAddress.trim(),
            postcode: shipPostcode.trim() || undefined,
            shipping_fee: shippingFee,
          },
          subtotal: cartSubtotal,
          discountTotal,
          total: cartTotal,
          couponCodes: validSelectedCouponCodes,
        },
      });
      if (checkoutError) {
        setCheckoutMessage(`支付失败：${checkoutError.message}`);
        return;
      }
      const officialOrderId = ((checkoutDataRaw as { data?: { officialOrderId?: string } } | null)?.data?.officialOrderId ?? "").trim();
      if (!officialOrderId) {
        setCheckoutMessage("支付失败：未返回订单号");
        return;
      }
      const intent = await createPayexIntent({
        officialOrderId,
        channel: "shop",
        returnUrl: `${window.location.origin}/payment/result`,
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
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100 font-display">
      <Navbar cartCount={cartCount} onCartClick={() => router.push("/shop/checkout")} />

      <nav className="w-full border-b border-primary/10 bg-background-light px-3 md:px-10 dark:bg-background-dark">
        <div className="max-w-7xl mx-auto flex items-center gap-8 overflow-x-auto no-scrollbar">
          {[
            { key: "bundle" as const, label: "Bundle Set" },
            { key: "ala_carte" as const, label: "A La Carte" },
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCategory(cat.key);
                const el = cat.key === "bundle" ? bundleRef.current : alaRef.current;
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`flex flex-col items-center justify-center border-b-2 py-4 whitespace-nowrap transition-colors ${
                activeCategory === cat.key ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-primary"
              }`}
            >
              <span className="text-sm font-bold">{cat.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 py-5 md:px-4 md:py-6">
        <section className="mb-5 rounded-2xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mb-6 md:p-6">
          <p className="text-[11px] font-black tracking-[0.16em] text-primary">SHOP HOTPOT</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100 md:text-4xl">
            男朋友火锅商城
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 md:text-base">
            选购花胶汤包、火锅汤底与 Bundle Set，在官网完成下单与结算。想吃现煮火锅可前往
            {" "}
            <Link href="/delivery" className="font-bold text-primary hover:text-primary/80">
              火锅外卖专区
            </Link>
            ，第一次认识品牌也可先查看
            {" "}
            <Link href="/" className="font-bold text-primary hover:text-primary/80">
              首页品牌介绍
            </Link>
            。
          </p>
        </section>

        <div className="group relative mb-4 h-[176px] w-full overflow-hidden rounded-2xl border border-primary/10 md:mb-8 md:h-56">
          <div className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-primary/95 via-primary/72 to-primary/28 px-4 py-3 md:justify-center md:bg-gradient-to-r md:from-primary/95 md:via-primary/65 md:to-primary/25 md:px-12">
            <span className="mb-2 inline-block w-fit rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-sm md:mb-3 md:text-xs">
              {promotions && promotions.length > 0 ? "商城促销" : "限时优惠"}
            </span>
            <h2 className="line-clamp-2 max-w-[88%] text-base font-black leading-tight text-white md:max-w-xl md:text-4xl">
              {activePromotion ? activePromotion.title : activeBanner?.title ?? "欢迎来到男朋友商城"}
            </h2>
            <p className="mt-1 line-clamp-2 max-w-[88%] text-[11px] leading-snug text-white/85 md:mt-2 md:max-w-md md:text-base md:leading-relaxed">
              {activeBanner?.subtitle ?? "精选汤包与套餐组合，支持 MYR/SGD 多币种定价。"}
            </p>
            <button type="button" onClick={() => router.push(activeBanner?.cta_href ?? "/shop")} className="shop-hero-cta-button tap-bouncy mt-2 inline-flex h-9 w-fit items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-[color:var(--warm-neutral-900)] transition-colors hover:bg-slate-100 active:scale-[0.98] md:mt-3 md:h-auto md:rounded-lg md:px-6 md:py-2 md:text-sm">
              <span className="material-symbols-outlined text-lg text-[color:var(--warm-neutral-900)]">shopping_bag</span>
              {activeBanner?.cta_text ?? "立即购买"}
            </button>
          </div>
          <div className="absolute inset-0">
            {activePromotion?.video_url ? (
              <video src={activePromotion.video_url} autoPlay muted loop playsInline className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <Image
                src={activePromotion?.image_url ?? activeBanner?.image_url ?? assetPath("/logo.png")}
                alt={activePromotion?.title ?? activeBanner?.title ?? "banner"}
                fill
                sizes="100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                priority
              />
            )}
          </div>
        </div>

          <div className={`grid gap-6 ${isCartOpen ? "lg:grid-cols-[1fr_340px]" : "lg:grid-cols-1"}`}>
          <div>
            <div ref={bundleRef} className="mb-8 scroll-mt-28">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bundle Set</h3>
                <Link href="/shop/bundles" className="text-sm font-bold text-primary hover:text-primary/80">
                  查看全部
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
                {(bundles ?? []).slice(0, 6).map((bundle) => (
                  <Link key={bundle.id} href={`/shop/bundle?id=${bundle.id}`} className="group rounded-2xl overflow-hidden border border-primary/10 bg-[color:var(--theme-surface-elevated)] shadow-sm transition-all hover:shadow-xl dark:bg-[color:var(--theme-surface-elevated)]">
                    <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-white/5">
                      {bundle.image_url ? (
                        <Image
                          src={bundle.image_url}
                          alt={bundle.title}
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-bold text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                          暂无图片
                        </div>
                      )}
                      <div className="absolute left-3 top-3 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Bundle</div>
                    </div>
                    <div className="p-2.5 md:p-4">
                      <p className="line-clamp-2 text-xs font-black md:text-sm">{bundle.title}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-300 md:text-sm">{bundle.rule_kind === "buy_x_get_y" ? `买 ${bundle.buy_qty ?? 0} 送 ${bundle.free_qty ?? 0}` : "自选组合（客制化）"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div ref={alaRef} className="scroll-mt-28">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">A La Carte</h3>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>币种:</span>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)} className="bg-transparent border-none focus:ring-0 cursor-pointer font-medium text-primary outline-none">
                    <option value="MYR">MYR</option>
                    <option value="SGD">SGD</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
              {products.map((product) => (
                <div key={product.id} className="group flex flex-col rounded-2xl overflow-hidden border border-primary/10 bg-[color:var(--theme-surface-elevated)] shadow-sm transition-all hover:shadow-xl dark:bg-[color:var(--theme-surface-elevated)]">
                  <div className="relative">
                    <Link href={`/shop/detail?id=${product.id}`}>
                      <HoverCarouselImage images={product.images} alt={product.name} />
                    </Link>
                    {product.tag ? <div className={`${product.tagColor || "bg-primary"} absolute top-2 left-2 rounded px-2 py-1 text-[10px] font-bold text-white`}>{product.tag}</div> : null}
                  </div>
                  <div className="flex flex-1 flex-col p-2.5 md:p-4">
                    <Link href={`/shop/detail?id=${product.id}`}>
                      <h4 className="mb-1 line-clamp-2 text-xs font-bold text-slate-900 dark:text-slate-100 md:text-sm">{product.name}</h4>
                    </Link>
                    <p className="mb-1.5 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400 md:mb-3 md:text-xs">{product.desc}</p>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-sm font-bold text-primary md:text-lg">{currency === "SGD" ? "S$" : "RM"} {product.price.toFixed(2)}</span>
                      <BouncyActionButton
                        onClick={() => {
                          if (!isAuthed) {
                            setAuthPromptOpen(true);
                            return;
                          }
                          addItem(product.id, 1);
                          setToast("已加入购物车");
                          setCheckoutMessage(null);
                          triggerAddedPulse(product.id);
                        }}
                        success={isAddedPulsing(product.id)}
                        icon={<span className="material-symbols-outlined">add_shopping_cart</span>}
                        successIcon={<span className="material-symbols-outlined">done_all</span>}
                        contentClassName="cart-action-content"
                        className={`flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-white transition-colors shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 md:h-9 md:w-9 md:rounded-lg ${isAddedPulsing(product.id) ? "ring-2 ring-white/70" : ""}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <section className="mt-10 rounded-2xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mt-12">
              <p className="text-[11px] font-black tracking-[0.14em] text-primary">SHOP DEFINITION</p>
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                男朋友火锅商城是品牌的官方零售入口，主打可在家加热食用的花胶汤包、火锅汤底与 Bundle Set，适合家庭备餐、送礼与日常囤货。
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                <Link href="/shop/bundles" className="inline-flex rounded-full border border-primary/15 bg-primary/5 px-3 py-2 text-primary hover:bg-primary/10">
                  查看 Bundle Set
                </Link>
                <Link href="/delivery" className="inline-flex rounded-full border border-primary/15 bg-primary/5 px-3 py-2 text-primary hover:bg-primary/10">
                  即点即送请看外卖
                </Link>
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70 md:mt-10 md:p-5">
              <p className="text-[11px] font-black tracking-[0.14em] text-primary">SHOP FAQ</p>
              <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100 md:text-2xl">
                商城常见问题
              </h2>
              <div className="mt-4 space-y-3">
                {shopFaqItems.map((item, index) => (
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

            <div className="mt-12 flex justify-center">
              <button className="tap-bouncy flex items-center gap-2 rounded-lg border-2 border-primary px-8 py-3 font-bold text-primary transition-all hover:bg-primary hover:text-white">
                <span className="material-symbols-outlined">refresh</span>
                加载更多商品
              </button>
            </div>
          </div>

          <aside className={`${isCartOpen ? "hidden lg:block" : "hidden"}`}>
            <div className="sticky top-24 rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black tracking-[0.12em] text-primary">SHOP CHECKOUT</p>
                  <h3 className="mt-1 text-lg font-black">购物车</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">{cartCount} 件</span>
                  {cartItems.length > 0 ? (
                    <button type="button" onClick={clearCart} className="text-xs font-bold text-rose-600 hover:text-rose-500">
                      清空
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setIsCartOpen(false)} className="tap-bouncy text-slate-400 hover:text-primary">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              </div>
              <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                {cartItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">购物车为空</p>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.key} className="rounded-xl border border-[color:var(--theme-border)] bg-black/2 p-3 dark:border-[color:var(--theme-border-strong)] dark:bg-white/4">
                      <div className="flex gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white dark:bg-slate-900">
                          <Image src={item.image} alt={item.title} fill sizes="56px" className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{currencyPrefix} {item.price.toFixed(2)}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button type="button" onClick={() => changeCartQty(item.id, Math.max(0, item.qty - 1))} className="h-6 w-6 rounded-md border border-primary/30 text-primary hover:bg-primary/10">-</button>
                            <span className="w-6 text-center text-xs font-bold">{item.qty}</span>
                            <button type="button" onClick={() => changeCartQty(item.id, item.qty + 1)} className="h-6 w-6 rounded-md border border-primary/30 text-primary hover:bg-primary/10">+</button>
                            <button type="button" onClick={() => removeCartItem(item.id)} className="ml-auto text-xs font-bold text-rose-600 hover:text-rose-500">移除</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.12em] text-primary">DELIVERY INFO</p>
                      <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">
                        {shipName.trim() ? shipName : "待填写收货资料"}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--theme-muted)]">
                        {[shipPhone, shipAddress].filter(Boolean).join(" · ") || "填写后可快速完成商城下单"}
                      </p>
                    </div>
                    {!useProfileShipping && profileShipping ? (
                      <button type="button" onClick={applyProfileShipping} className="rounded-full border border-primary/25 px-3 py-1.5 text-[11px] font-bold text-primary">
                        一键带入
                      </button>
                    ) : null}
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={useProfileShipping}
                    onChange={(event) => handleProfileShippingToggle(event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>与账户个人信息地址资料相同</span>
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人姓名</p>
                  <input value={shipName} onChange={(event) => setShipName(event.target.value)} placeholder="请输入收货人姓名" readOnly={useProfileShipping} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70" />
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人电话</p>
                  <input value={shipPhone} onChange={(event) => setShipPhone(event.target.value)} placeholder="请输入手机号码" readOnly={useProfileShipping} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70" />
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货地址</p>
                  <input value={shipAddress} onChange={(event) => setShipAddress(event.target.value)} placeholder="请输入完整地址（门牌号/楼层/门铃）" readOnly={useProfileShipping} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70" />
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">邮编</p>
                  <input value={shipPostcode} onChange={(event) => setShipPostcode(event.target.value)} placeholder="可选填写邮编" readOnly={useProfileShipping} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70" />
                </label>
                <div className="block rounded-2xl border border-primary/15 bg-primary/5 p-3">
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
                    selectedCodes={validSelectedCouponCodes}
                    onToggle={toggleCouponCode}
                    placeholder="选择当前用户可用优惠券"
                  />
                  {selectedCouponOptions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedCouponOptions.map((option) => (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => setSelectedCouponCodes(validSelectedCouponCodes.filter((code) => code !== option.code))}
                          className="rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-[11px] font-bold text-primary dark:bg-slate-900/60"
                        >
                          {option.title} · -{currencyPrefix} {option.discountAmount.toFixed(2)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">不可叠加或不符合条件的优惠券会自动灰暗。可叠加的优惠券可同时选择。</p>
                  )}
                </div>
                <div className="space-y-2 rounded-xl bg-black/2 p-3 text-sm dark:bg-white/4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">商品小计</span>
                    <span className="font-bold">{currencyPrefix} {cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">运费</span>
                    <span className="font-bold">{currencyPrefix} {shippingFee.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">优惠</span>
                    <span className="font-bold">-{currencyPrefix} {discountTotal.toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-slate-200 dark:bg-slate-700" />
                  <div className="flex items-center justify-between">
                    <span className="font-black">总计</span>
                    <span className="text-lg font-black text-primary">{currencyPrefix} {cartTotal.toFixed(2)}</span>
                  </div>
                </div>
                <button type="button" disabled={cartItems.length === 0 || submitting} onClick={() => void handleCheckout()} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-black text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? "提交中..." : "立即结算"}
                </button>
                {checkoutMessage ? <p className="text-xs font-bold text-primary">{checkoutMessage}</p> : null}
              </div>
            </div>
          </aside>
        </div>

        {toast ? <div className="fixed right-4 top-[92px] z-50 rounded-xl bg-[color:var(--foreground)] px-4 py-3 text-sm font-bold text-[color:var(--theme-surface-elevated)] shadow-lg dark:bg-white dark:text-slate-900 md:right-5 md:top-auto md:bottom-5">{toast}</div> : null}

        {isCartOpen ? (
          <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm lg:hidden" onClick={() => setIsCartOpen(false)}>
            <div className="absolute bottom-[calc(var(--mobile-bottom-nav-height)+var(--safe-area-bottom)+34px)] left-3 right-3 top-[96px] overflow-y-auto rounded-[28px] border border-primary/10 bg-white p-4 shadow-2xl dark:border-primary/15 dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black tracking-[0.12em] text-primary">SHOP CHECKOUT</p>
                  <h3 className="mt-1 text-lg font-black">购物车与结算</h3>
                </div>
                <div className="flex items-center gap-2">
                  {cartItems.length > 0 ? (
                    <button type="button" onClick={clearCart} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 dark:border-rose-900/60">
                      清空
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setIsCartOpen(false)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold dark:border-slate-700">关闭</button>
                </div>
              </div>
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-white/70 px-2 py-3 dark:bg-slate-900/60">
                    <p className="text-[10px] text-slate-500">商品数</p>
                    <p className="mt-1 text-base font-black text-[color:var(--foreground)]">{cartCount}</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 px-2 py-3 dark:bg-slate-900/60">
                    <p className="text-[10px] text-slate-500">优惠</p>
                    <p className="mt-1 text-base font-black text-primary">-{currencyPrefix} {discountTotal.toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 px-2 py-3 dark:bg-slate-900/60">
                    <p className="text-[10px] text-slate-500">总计</p>
                    <p className="mt-1 text-base font-black text-[color:var(--foreground)]">{currencyPrefix} {cartTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-black tracking-[0.12em] text-primary">ITEMS</p>
                  <p className="text-xs font-bold text-slate-500">{cartItems.length} 个条目</p>
                </div>
                <div className="max-h-[32vh] space-y-2 overflow-y-auto pr-1">
                {cartItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">购物车为空</p>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.key} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white dark:bg-slate-950/60">
                          <Image src={item.image} alt={item.title} fill sizes="56px" className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-sm font-bold">{item.title}</p>
                            <p className="shrink-0 text-xs font-bold text-slate-500">{currencyPrefix} {item.price.toFixed(2)}</p>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button type="button" onClick={() => changeCartQty(item.id, Math.max(0, item.qty - 1))} className="h-7 w-7 rounded-full border border-primary/30 text-primary hover:bg-primary/10">-</button>
                            <span className="w-6 text-center text-xs font-bold">{item.qty}</span>
                            <button type="button" onClick={() => changeCartQty(item.id, item.qty + 1)} className="h-7 w-7 rounded-full border border-primary/30 text-primary hover:bg-primary/10">+</button>
                            <button type="button" onClick={() => removeCartItem(item.id)} className="ml-auto text-xs font-bold text-rose-600">移除</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.12em] text-primary">DELIVERY INFO</p>
                      <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">
                        {shipName.trim() ? shipName : "待填写收货资料"}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--theme-muted)]">
                        {[shipPhone, shipAddress].filter(Boolean).join(" · ") || "填写后可直接进入支付"}
                      </p>
                    </div>
                    {!useProfileShipping && profileShipping ? (
                      <button type="button" onClick={applyProfileShipping} className="rounded-full border border-primary/25 px-3 py-1.5 text-[11px] font-bold text-primary">
                        一键带入
                      </button>
                    ) : null}
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={useProfileShipping}
                    onChange={(event) => handleProfileShippingToggle(event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>与账户个人信息地址资料相同</span>
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人姓名</p>
                  <input value={shipName} onChange={(event) => setShipName(event.target.value)} placeholder="请输入收货人姓名" readOnly={useProfileShipping} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70" />
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人电话</p>
                  <input value={shipPhone} onChange={(event) => setShipPhone(event.target.value)} placeholder="请输入手机号码" readOnly={useProfileShipping} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70" />
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货地址</p>
                  <input value={shipAddress} onChange={(event) => setShipAddress(event.target.value)} placeholder="请输入完整地址（门牌号/楼层/门铃）" readOnly={useProfileShipping} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70" />
                </label>
                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">邮编</p>
                  <input value={shipPostcode} onChange={(event) => setShipPostcode(event.target.value)} placeholder="可选填写邮编" readOnly={useProfileShipping} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/70" />
                </label>
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.12em] text-primary">COUPONS</p>
                      <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">选择优惠券</p>
                    </div>
                    <span className="rounded-full border border-primary/20 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-primary dark:bg-slate-900/60">
                      已选 {selectedCouponOptions.length}
                    </span>
                  </div>
                  <MemberCouponDropdown
                    options={userCouponOptions}
                    selectedCodes={validSelectedCouponCodes}
                    onToggle={toggleCouponCode}
                    placeholder="选择当前用户可用优惠券"
                  />
                  {selectedCouponOptions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedCouponOptions.map((option) => (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => setSelectedCouponCodes(validSelectedCouponCodes.filter((code) => code !== option.code))}
                          className="rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-[11px] font-bold text-primary dark:bg-slate-900/60"
                        >
                          {option.title} · -{currencyPrefix} {option.discountAmount.toFixed(2)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-[11px] font-black tracking-[0.12em] text-primary">SUMMARY</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-slate-500">小计</p>
                      <p className="font-bold">{currencyPrefix} {cartSubtotal.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-slate-500">运费</p>
                      <p className="font-bold">{currencyPrefix} {shippingFee.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-slate-500">优惠</p>
                      <p className="font-bold text-primary">-{currencyPrefix} {discountTotal.toFixed(2)}</p>
                    </div>
                    <div className="h-px bg-slate-200 dark:bg-slate-700" />
                    <div className="flex items-center justify-between">
                      <p className="font-bold">总计</p>
                      <p className="text-lg font-black text-primary">{currencyPrefix} {cartTotal.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <button type="button" disabled={cartItems.length === 0 || submitting} onClick={() => void handleCheckout()} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-black text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? "提交中..." : "立即结算"}
                </button>
                {checkoutMessage ? <p className="text-xs font-bold text-primary">{checkoutMessage}</p> : null}
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {cartCount > 0 && !isCartOpen ? (
        <div className="mobile-sticky-action-bar md:hidden">
          <div className="mobile-sticky-action-bar__inner">
            <button
              type="button"
              onClick={() => router.push("/shop/checkout")}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <span className="material-symbols-outlined !text-primary">shopping_cart</span>
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-black text-[color:var(--foreground)]">{cartCount} 件商品待结算</p>
                <p className="text-xs text-[color:var(--theme-muted)]">小计 {currencyPrefix} {cartSubtotal.toFixed(2)}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => router.push("/shop/checkout")}
              className="tap-bouncy shrink-0 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white shadow-lg shadow-primary/25"
            >
              查看购物车
            </button>
          </div>
        </div>
      ) : null}

      <div className="hidden md:block">
        <Footer />
      </div>
      <div aria-hidden className="mobile-page-bottom-space md:hidden" />
      <UnifiedModal
        open={authPromptOpen}
        title="登录后下单更划算"
        description="先登录/注册再下单可累计会员积分与返利记录。"
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
          完成登录后，下单消费可自动累计积分，后续可用于兑换优惠券和参与会员返利活动。
        </div>
      </UnifiedModal>
    </div>
  );
}
