"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import {
  fetchOfficialBundles,
  fetchOfficialShopShippingRates,
  fetchOfficialSoupPackVariants,
  type OfficialBundle,
  type OfficialShopShippingRate,
  type OfficialSoupPackVariant,
} from "@/lib/admin/official-shop";
import {
  clearCart,
  countItems,
  readCartState,
  removeCartItem,
  type CartState,
  writeCartState,
} from "@/lib/shop-cart";
import { MemberCouponDropdown, type MemberCouponDropdownOption } from "@/components/member-coupon-dropdown";
import { UnifiedModal } from "@/components/unified-modal";
import { createPayexIntent } from "@/lib/payments/payex";
import { assetPath } from "@/lib/site-config";
import { supabase } from "@/lib/supabase";

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

export default function ShopCheckoutPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState<"MYR" | "SGD">("MYR");
  const [rows, setRows] = useState<OfficialSoupPackVariant[] | null>(null);
  const [bundles, setBundles] = useState<OfficialBundle[] | null>(null);
  const [shippingRates, setShippingRates] = useState<OfficialShopShippingRate[] | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [cartState, setCartState] = useState<CartState>({ version: 2, items: [] });
  const [couponEvaluationTime] = useState(() => Date.now());
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

  useEffect(() => {
    let active = true;
    Promise.all([fetchOfficialSoupPackVariants(), fetchOfficialBundles(), fetchOfficialShopShippingRates()]).then(([variants, bundlesData, shippingRatesData]) => {
      if (!active) return;
      setRows(variants.filter((v) => v.status === "active"));
      setBundles(bundlesData.filter((b) => b.status === "active"));
      setShippingRates(shippingRatesData);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadProfileShipping = async () => {
      const client = supabase;
      if (!client) return;
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

  const cartItems = useMemo(() => {
    const variantMap = new Map((rows ?? []).map((variant) => [String(variant.id), variant]));
    const bundleMap = new Map((bundles ?? []).map((bundle) => [String(bundle.id), bundle]));
    return cartState.items.map((item) => {
      if (item.kind === "bundle") {
        const bundle = bundleMap.get(item.bundleId);
        return {
          key: item.id,
          id: item.id,
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

  const changeCartQty = (id: string, nextQty: number) => {
    const nextItems = readCartState().items
      .map((item) => {
        if (item.id !== id) return item;
        return { ...item, qty: Math.max(0, Math.floor(nextQty)) };
      })
      .filter((item) => item.qty > 0);
    writeCartState({ version: 2, items: nextItems });
  };

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
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light font-display text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <Navbar cartCount={cartCount} onCartClick={() => void 0} />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-3 py-4 md:px-4 md:py-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm md:flex-row md:items-end md:justify-between md:p-5">
          <div>
            <p className="text-[11px] font-black tracking-[0.14em] text-primary">SHOP CHECKOUT</p>
            <h1 className="mt-2 text-2xl font-black">商城结算</h1>
            <p className="mt-1 text-sm text-[color:var(--theme-muted)]">统一整页式结算，先确认商品，再填写收货资料与优惠券。</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push("/shop")} className="rounded-2xl border border-primary/15 px-4 py-3 text-sm font-bold text-[color:var(--foreground)]">
              返回商城
            </button>
            <div className="rounded-2xl bg-primary/8 px-4 py-3 text-sm font-black text-primary">{cartCount} 件商品</div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-4">
            <div className="rounded-3xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black tracking-[0.14em] text-primary">ITEMS</p>
                  <h2 className="mt-1 text-lg font-black">购物车商品</h2>
                </div>
                {cartItems.length > 0 ? (
                  <button type="button" onClick={clearCart} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 dark:border-rose-900/60">
                    清空购物车
                  </button>
                ) : null}
              </div>
              <div className="space-y-3">
                {cartItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    购物车为空，先去商城挑选商品。
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.key} className="rounded-2xl border border-primary/10 bg-black/3 p-3 dark:bg-white/3">
                      <div className="flex gap-3">
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900">
                          <Image src={item.image} alt={item.title} fill className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-black">{item.title}</p>
                              <p className="mt-1 text-xs text-[color:var(--theme-muted)]">单价 {currencyPrefix} {item.price.toFixed(2)}</p>
                            </div>
                            <button type="button" onClick={() => removeCartItem(item.id)} className="text-xs font-bold text-rose-600">
                              移除
                            </button>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => changeCartQty(item.id, Math.max(0, item.qty - 1))} className="h-8 w-8 rounded-full border border-primary/25 text-sm font-bold text-primary">
                                -
                              </button>
                              <span className="w-8 text-center text-sm font-black">{item.qty}</span>
                              <button type="button" onClick={() => changeCartQty(item.id, item.qty + 1)} className="h-8 w-8 rounded-full border border-primary/25 text-sm font-bold text-primary">
                                +
                              </button>
                            </div>
                            <p className="text-base font-black text-primary">{currencyPrefix} {(item.price * item.qty).toFixed(2)}</p>
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
                  <p className="text-[11px] font-black tracking-[0.14em] text-primary">DELIVERY INFO</p>
                  <h2 className="mt-1 text-lg font-black">收货资料</h2>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>币种</span>
                  <select value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)} className="rounded-full border border-primary/15 bg-transparent px-3 py-1.5 font-bold text-primary outline-none">
                    <option value="MYR">MYR</option>
                    <option value="SGD">SGD</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.12em] text-primary">PROFILE FILL</p>
                      <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{shipName.trim() ? shipName : "待填写收货资料"}</p>
                      <p className="mt-1 text-xs text-[color:var(--theme-muted)]">{[shipPhone, shipAddress].filter(Boolean).join(" · ") || "填写后可直接跳转支付"}</p>
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

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人姓名</p>
                    <input value={shipName} onChange={(event) => setShipName(event.target.value)} placeholder="请输入收货人姓名" readOnly={useProfileShipping} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                  </label>
                  <label className="block">
                    <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货人电话</p>
                    <input value={shipPhone} onChange={(event) => setShipPhone(event.target.value)} placeholder="请输入手机号码" readOnly={useProfileShipping} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                  </label>
                </div>

                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">收货地址</p>
                  <input value={shipAddress} onChange={(event) => setShipAddress(event.target.value)} placeholder="请输入完整地址（门牌号/楼层/门铃）" readOnly={useProfileShipping} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
                </label>

                <label className="block">
                  <p className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">邮编</p>
                  <input value={shipPostcode} onChange={(event) => setShipPostcode(event.target.value)} placeholder="可选填写邮编" readOnly={useProfileShipping} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-900/70" />
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
                selectedCodes={validSelectedCouponCodes}
                onToggle={toggleCouponCode}
                placeholder="选择当前用户可用优惠券"
              />
              {selectedCouponOptions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedCouponOptions.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => setSelectedCouponCodes(validSelectedCouponCodes.filter((code) => code !== option.code))}
                      className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-bold text-primary"
                    >
                      {option.title} · -{currencyPrefix} {option.discountAmount.toFixed(2)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-[color:var(--theme-muted)]">不可叠加或不符合条件的优惠券会自动灰暗，可叠加优惠券可同时选择。</p>
              )}
            </div>

            <div className="rounded-3xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm">
              <p className="text-[11px] font-black tracking-[0.14em] text-primary">PAYMENT SUMMARY</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--theme-muted)]">商品小计</span>
                  <span className="font-bold">{currencyPrefix} {cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--theme-muted)]">运费</span>
                  <span className="font-bold">{currencyPrefix} {shippingFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--theme-muted)]">优惠</span>
                  <span className="font-bold text-primary">-{currencyPrefix} {discountTotal.toFixed(2)}</span>
                </div>
                <div className="h-px bg-[color:var(--theme-border)]" />
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] text-[color:var(--theme-muted)]">总计</p>
                    <p className="text-2xl font-black text-primary">{currencyPrefix} {cartTotal.toFixed(2)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={cartItems.length === 0 || submitting}
                    onClick={() => void handleCheckout()}
                    className="rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "提交中..." : "立即支付"}
                  </button>
                </div>
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
