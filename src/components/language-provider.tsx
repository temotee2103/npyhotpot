"use client";

import { createContext, useContext, useMemo, useState } from "react";

type Language = "zh-CN" | "en";

type Dictionary = Record<string, { "zh-CN": string; en: string }>;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
};

const dictionary: Dictionary = {
  // Navigation & Common
  navShop: { "zh-CN": "在线商城", en: "Online Shop" },
  navDelivery: { "zh-CN": "外卖配送", en: "Food Delivery" },
  navHome: { "zh-CN": "首页", en: "Home" },
  navStory: { "zh-CN": "品牌故事", en: "Our Story" },
  navLocations: { "zh-CN": "门店分布", en: "Locations" },
  switchLang: { "zh-CN": "EN", en: "中文" },
  
  // Auth
  authTitle: { "zh-CN": "登录或注册", en: "Login or Register" },
  authDesc: { "zh-CN": "使用账号继续访问完整功能", en: "Continue with full features using your account" },
  login: { "zh-CN": "登录", en: "Login" },
  register: { "zh-CN": "注册", en: "Register" },
  continueGuest: { "zh-CN": "继续游客浏览", en: "Continue as Guest" },
  googleLogin: { "zh-CN": "使用 Google 登录", en: "Continue with Google" },
  email: { "zh-CN": "邮箱", en: "Email" },
  password: { "zh-CN": "密码", en: "Password" },
  
  // Landing Page
  heroTitle: { "zh-CN": "把正宗火锅带回家", en: "Authentic Hotpot, At Your Table" },
  heroSubtitle: { "zh-CN": "男朋友火锅，不仅仅是火锅。我们主打【XO花胶麻油鸡汤】，选用上等深海鱼胶与走地鸡慢火熬制，让您在家也能享受滋补养颜的顶级火锅体验。", en: "Nan Peng You Hotpot redefines home dining with our signature XO Fish Maw Sesame Chicken Soup. Slow-cooked with premium deep-sea fish maw and free-range chicken, we bring a nourishing and luxurious hotpot experience directly to your home." },
  shopBtn: { "zh-CN": "立即选购汤包", en: "Shop Soup Packs" },
  deliveryBtn: { "zh-CN": "点外卖", en: "Order Delivery" },
  
  storyTitle: { "zh-CN": "关于男朋友", en: "Our Story" },
  storyDesc: { "zh-CN": "男朋友火锅创立于2023年，我们的招牌【XO花胶麻油鸡汤】深受食客喜爱。被誉为“火锅界的滋补神器”，每一口汤底都蕴含着满满的胶原蛋白。无论是家庭聚餐还是深夜食堂，男朋友都是您的温暖首选。", en: "Established in 2023, Nan Peng You Hotpot is famous for our signature XO Fish Maw Sesame Chicken Soup. Known as the 'Ultimate Nourishing Pot', every sip is packed with collagen. Whether it's a family reunion or a late-night craving, Nan Peng You is your warmest companion." },
  
  featuresTitle: { "zh-CN": "为什么选择我们？", en: "The Nan Peng You Standard" },
  feature1Title: { "zh-CN": "严选食材", en: "Premium Ingredients" },
  feature1Desc: { "zh-CN": "甄选深海鱼胶与新鲜走地鸡，真材实料。", en: "Selected deep-sea fish maw and fresh free-range chicken." },
  feature2Title: { "zh-CN": "古法熬制", en: "Slow-Cooked" },
  feature2Desc: { "zh-CN": "坚持每日慢火熬煮，汤浓味鲜，不添加防腐剂。", en: "Daily slow-cooked broth, rich and savory, with no preservatives." },
  feature3Title: { "zh-CN": "加热即食", en: "Ready to Eat" },
  feature3Desc: { "zh-CN": "冷冻锁鲜技术，简单加热即可还原堂食美味。", en: "Frozen fresh technology. Simply heat up to enjoy restaurant-quality taste." },

  locationsTitle: { "zh-CN": "门店列表", en: "Our Locations" },
  visitUs: { "zh-CN": "欢迎光临，体验最纯粹的火锅文化。", en: "Visit us to experience the purest hotpot culture." },
  viewMap: { "zh-CN": "查看地图", en: "View Map" },

  // Shop Page
  shopBannerTitle: { "zh-CN": "限时特惠", en: "Limited Time Offer" },
  shopBannerDesc: { "zh-CN": "购买任意汤包组合，即送精美蘸料一份！", en: "Get a free dipping sauce with any soup pack bundle purchase!" },
  shopCategories: { "zh-CN": "商品分类", en: "Categories" },
  catAll: { "zh-CN": "全部商品", en: "All Products" },
  catSoup: { "zh-CN": "特色汤包", en: "Signature Soup Packs" },
  catBundle: { "zh-CN": "超值组合", en: "Value Bundles" },
  
  shopTitle: { "zh-CN": "汤包商城", en: "Soup Pack Shop" },
  shopSubtitle: { "zh-CN": "男朋友官方正品汤包与组合优惠", en: "Only official Nan Peng You Soup Pack variants and bundles." },
  addToCart: { "zh-CN": "加入购物车", en: "Add to Cart" },
  customerDetails: { "zh-CN": "收货信息", en: "Customer Details" },
  fullName: { "zh-CN": "姓名", en: "Full Name" },
  phone: { "zh-CN": "手机号", en: "Phone Number" },
  address: { "zh-CN": "收货地址", en: "Delivery Address" },
  checkout: { "zh-CN": "结算", en: "Checkout" },
  total: { "zh-CN": "合计", en: "Total" },
  payBtn: { "zh-CN": "前往支付", en: "Pay with Gateway" },
  processing: { "zh-CN": "处理中...", en: "Processing..." },
  cartEmpty: { "zh-CN": "购物车为空", en: "Your cart is empty" },
  fillDetails: { "zh-CN": "请完善收货信息", en: "Please complete customer details" },
  paymentCreated: { "zh-CN": "支付会话已创建", en: "Payment session has been created" },
  paymentFailed: { "zh-CN": "支付请求失败", en: "Payment request failed" },
  
  // Delivery Page
  deliveryTitle: { "zh-CN": "外卖点餐", en: "Food Delivery Platform" },
  deliverySubtitle: { "zh-CN": "在线支付 + Lalamove 自动配送", en: "Payment gateway + automatic Lalamove assignment workflow." },
  deliveryDetails: { "zh-CN": "配送信息", en: "Delivery Details" },
  dropoffAddress: { "zh-CN": "送达地址", en: "Drop-off Address" },
  addItem: { "zh-CN": "添加", en: "Add Item" },
  payAndAssign: { "zh-CN": "支付并呼叫配送", en: "Pay and Auto-Assign Driver" },
  submitting: { "zh-CN": "提交中...", en: "Submitting..." },
  orderSuccess: { "zh-CN": "支付成功，已开始派单。", en: "Payment accepted. Lalamove auto-assignment started." },
  orderFailed: { "zh-CN": "下单失败", en: "Order flow request failed." },
  
  // Admin Page
  adminTitle: { "zh-CN": "运营控制台", en: "Operations Dashboard" },
  adminSubtitle: { "zh-CN": "统一管理菜单、订单、配送、用户和报表。", en: "Control menu, orders, deliveries, users, and reports." },
  dailySales: { "zh-CN": "今日销售额", en: "Daily Sales" },
  soupOrders: { "zh-CN": "汤包订单", en: "Soup Pack Orders" },
  deliveryOrders: { "zh-CN": "外卖订单", en: "Delivery Orders" },
  activeJobs: { "zh-CN": "Lalamove 进行中", en: "Lalamove Active Jobs" },
  moduleMenu: { "zh-CN": "菜单管理", en: "Menu Management" },
  modulePack: { "zh-CN": "汤包规格", en: "Soup Pack Variants" },
  modulePromo: { "zh-CN": "促销活动", en: "Promotions" },
  moduleUsers: { "zh-CN": "用户管理", en: "Users" },
  moduleTrans: { "zh-CN": "交易记录", en: "Transactions" },
  moduleTrack: { "zh-CN": "配送追踪", en: "Delivery Tracking" },
  moduleReports: { "zh-CN": "报表中心", en: "Reports" },
  moduleDesc: { "zh-CN": "已预留 Supabase 数据驱动的管理与分析能力。", en: "CRUD and analytics panel ready for Supabase-backed records." },
  openModule: { "zh-CN": "进入模块", en: "Open Module" },
  adminLogin: { "zh-CN": "管理员登录", en: "Admin Login" },
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "zh-CN";
    const stored = window.localStorage.getItem("site-language");
    return stored === "zh-CN" || stored === "en" ? stored : "zh-CN";
  });

  const applyLanguage = (next: Language) => {
    setLanguage(next);
    window.localStorage.setItem("site-language", next);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: applyLanguage,
      toggleLanguage: () => applyLanguage(language === "zh-CN" ? "en" : "zh-CN"),
      t: (key: string) => dictionary[key]?.[language] ?? key,
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
