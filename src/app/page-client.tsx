"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { homeQueryMapItems } from "@/lib/geo-content";
import { UnifiedModal } from "@/components/unified-modal";
import { assetPath } from "@/lib/site-config";

const sections = [
  { id: "hero", label: "首页" },
  { id: "brand", label: "品牌" },
  { id: "outlets", label: "门店" },
  { id: "retail", label: "即食" },
  { id: "delivery", label: "外卖" },
  { id: "faq", label: "FAQ" },
];

const image = (path: string) => encodeURI(assetPath(path));

export default function Home() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeSection, setActiveSection] = useState("hero");
  const [retailPreview, setRetailPreview] = useState<{ productId: string; photoIndex: number } | null>(null);
  const [outletCarouselIndex, setOutletCarouselIndex] = useState<Record<string, number>>({});

  const heroSlides = [
    {
      image: image("/hero/DSC00781.JPG"),
      title: "男朋友火锅",
      subtitle: "新派海鲜火锅与即食产品，一站式到店 + 到家体验",
    },
    {
      image: image("/hero/DSC00835.JPG"),
      title: "海鲜与汤底双核心",
      subtitle: "以门店现熬汤底为基础，打造稳定、鲜香、有层次的口感",
    },
    {
      image: image("/hero/DSC02424.JPG"),
      title: "线上线下同频运营",
      subtitle: "门店堂食、火锅外卖、即食汤包，满足不同消费场景",
    },
    {
      image: image("/hero/DSC06350.JPG"),
      title: "食材鲜度可见",
      subtitle: "坚持好食材与稳定出品，把每一口体验做扎实",
    },
    {
      image: image("/hero/DSC09044.JPG"),
      title: "从门店到家",
      subtitle: "堂食、外卖、即食产品多场景覆盖，随时都能吃得好",
    },
  ];

  const whatsappPresetMessage = encodeURIComponent("您好男朋友火锅，我想要订位。");

  const outletBranches = [
    {
      id: "bloomsvale",
      name: "Nan Peng You Hotpot - Bloomsvale",
      label: "Bloomsvale 分店",
      mapsUrl: "https://maps.app.goo.gl/86mYMtntgV8npwcy5",
      whatsappUrl: `https://wa.me/60198433519?text=${whatsappPresetMessage}`,
      summary: "主打聚餐与活动场景，空间宽敞，适合家庭与多人聚会。",
      photos: [
        image("/restaurant/Nan Peng You Hotpot - Bloomsvale/IMG_4885.JPG"),
        image("/restaurant/Nan Peng You Hotpot - Bloomsvale/IMG_4909.JPG"),
        image("/restaurant/Nan Peng You Hotpot - Bloomsvale/IMG_4952.JPG"),
        image("/restaurant/Nan Peng You Hotpot - Bloomsvale/IMG_5027.JPG"),
      ],
    },
    {
      id: "serdang",
      name: "Nan Peng You Hotpot - Serdang",
      label: "Serdang 分店",
      mapsUrl: "https://maps.app.goo.gl/XmeCScEz486j72BU8",
      whatsappUrl: `https://wa.me/60168556587?text=${whatsappPresetMessage}`,
      summary: "覆盖周边居民与学生客群，支持日常堂食与快节奏用餐。",
      photos: [
        image("/restaurant/Nan Peng You Hotpot - Serdang/Copy of IMG_9049.JPG"),
        image("/restaurant/Nan Peng You Hotpot - Serdang/Image_20230830171132.jpg"),
        image("/restaurant/Nan Peng You Hotpot - Serdang/Image_20230830171242.jpg"),
        image("/restaurant/Nan Peng You Hotpot - Serdang/dd1b285c-c6a6-4bf7-84e4-06654b863e17.jpg"),
      ],
    },
  ];

  const retailProducts = [
    {
      id: "fish-maw-golden",
      name: "【招牌金汤】花胶美颜汤",
      short: "经典必点、浓醇胶质、元气满满",
      intro:
        "作为“男朋友”家的镇店之宝，这款金汤花胶鸡传承了正宗港式打边炉的灵魂。精选散养走地鸡，搭配猪大骨与秘制金南瓜熬制 8 小时以上，汤头呈现诱人的金黄色泽。每一袋都含有厚实饱满的深海花胶，口感软糯 Q 弹。无需加水，加热即饮，让你在家也能喝到如星级餐厅般粘嘴、鲜甜的浓郁鸡汤。",
      keywords: ["经典必点", "浓醇胶质", "元气满满"],
      audience: "熬夜加班需要补元气、全家老少聚餐、追求极致浓郁口感的吃货。",
      photos: [
        image("/soup-pack/Golden Fish Maw Collagen Soup/cover-hj.png"),
        image("/soup-pack/Golden Fish Maw Collagen Soup/IMG_2637.JPG"),
        image("/soup-pack/Golden Fish Maw Collagen Soup/IMG_2764.JPG"),
      ],
    },
    {
      id: "xo-sesame",
      name: "【麻油滋补】XO花胶麻油鸡汤",
      short: "暖身御寒、独特香气、暖胃暖心",
      intro:
        "当经典花胶遇上香醇黑麻油，便是这款充满惊喜的“暖男”汤包。我们选用优质黑芝麻慢火压榨出的麻油，搭配 XO 级的秘制调味，汤底醇厚而不腻。黑麻油的温补特性与花胶的滋阴润燥完美融合，每一口汤都带着淡淡的麻油清香和花胶的鲜嫩。在阴冷的天气或身体疲惫时喝上一碗，瞬间由内而外暖遍全身。",
      keywords: ["暖身御寒", "独特香气", "暖胃暖心"],
      audience: "怕冷体质、经期后调理、坐月子及产后女性、偏爱独特香气的食客。",
      photos: [
        image("/soup-pack/Sesame Oil Chicken Soup/cover-sesame.png"),
        image("/soup-pack/Sesame Oil Chicken Soup/IMG_2861.JPG"),
        image("/soup-pack/Sesame Oil Chicken Soup/IMG_2869.JPG"),
        image("/soup-pack/Sesame Oil Chicken Soup/IMG_2891.JPG"),
        image("/soup-pack/Sesame Oil Chicken Soup/IMG_2897.JPG"),
      ],
    },
    {
      id: "porridge",
      name: "【清鲜入骨】花胶干贝粥包",
      short: "鲜掉眉毛、轻食养胃、细嫩软糯",
      intro:
        "这是一款将“海味”发挥到极致的治愈系粥品。我们选用颗粒饱满的苏北珍珠米，加入深海花胶与鲜甜干贝丝，采用文火慢熬至米粒开花、胶质交融。干贝的天然鲜咸完美渗入每一粒米中，无需过多元气调味，每一口都是来自海洋的纯净鲜美。它是给胃部最温柔的抚慰，让平凡的每一餐都变得精致且富有仪式感。",
      keywords: ["鲜掉眉毛", "轻食养胃", "细嫩软糯"],
      audience: "减脂期的轻食爱好者、差旅后的肠胃调理、需要营养早餐的上班族。",
      photos: [
        image("/soup-pack/Scallop-Porridge/cover-porridge.png"),
        image("/soup-pack/Scallop-Porridge/IMG_2930.JPG"),
        image("/soup-pack/Scallop-Porridge/IMG_2934.JPG"),
        image("/soup-pack/Scallop-Porridge/屏幕截图 2026-03-11 142819.png"),
      ],
    },
  ];

  const faqItems = [
    {
      question: "男朋友火锅是什么品牌？",
      answer: "男朋友火锅是一个在马来西亚同时经营门店堂食、火锅外卖与即食汤包零售的火锅品牌。",
    },
    {
      question: "堂食、外卖和商城商品有什么区别？",
      answer: "堂食适合到店聚餐，外卖适合即点即送的现煮火锅需求，商城则适合买可加热、可囤货、可送礼的即食汤包与 Bundle Set。",
    },
    {
      question: "男朋友火锅以什么内容最具代表性？",
      answer: "品牌代表性内容包括花胶滋补汤、火锅堂食体验，以及覆盖门店、外卖、即食零售的多场景服务路径。",
    },
  ];
  const aiAnswerItems = [
    {
      question: "男朋友火锅是什么？",
      answer: "男朋友火锅是一个位于马来西亚、同时经营门店堂食、火锅外卖与即食花胶汤包零售的多场景火锅品牌。",
    },
    {
      question: "男朋友火锅最有代表性的内容是什么？",
      answer: "品牌最具代表性的内容是花胶滋补汤、火锅体验，以及覆盖门店、外卖、商城三条消费路径的整合服务。",
    },
    {
      question: "用户通常应该怎么选购买路径？",
      answer: "想聚餐去门店，想立刻在家吃火锅选外卖，想备餐、囤货或送礼则进入商城购买即食汤包与 Bundle Set。",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.45, rootMargin: "-20% 0px -40% 0px" },
    );
    sections.forEach((item) => {
      const target = document.getElementById(item.id);
      if (target) observer.observe(target);
    });
    return () => observer.disconnect();
  }, []);

  const previewProduct = retailPreview ? retailProducts.find((item) => item.id === retailPreview.productId) ?? null : null;
  const previewIndex = previewProduct ? Math.min(Math.max(retailPreview?.photoIndex ?? 0, 0), previewProduct.photos.length - 1) : 0;

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light font-display text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <Navbar />

      <aside className="fixed left-4 top-1/2 z-40 hidden w-[62px] -translate-y-1/2 rounded-[22px] border border-primary/25 bg-[color:var(--theme-surface-elevated)] p-2 shadow-xl backdrop-blur lg:block dark:bg-[color:var(--theme-surface-elevated)]">
        <div className="flex flex-col gap-1">
          {sections.map((item, index) => (
            <button
              key={item.id}
              onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-1.5 py-1.5 text-center text-[10px] font-black leading-tight transition ${
                activeSection === item.id
                  ? "bg-primary text-white shadow-md shadow-primary/35"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
              type="button"
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${activeSection === item.id ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}`}>
                {index + 1}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1">
        <section id="hero" className="relative h-[72svh] min-h-[540px] w-full overflow-hidden sm:h-[80vh] sm:min-h-[620px]">
          {heroSlides.map((slide, index) => (
            <div
              key={slide.title}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${activeSlide === index ? "opacity-100" : "opacity-0"}`}
              style={{ backgroundImage: `url("${slide.image}")` }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/62 to-black/38 dark:from-black/75 dark:via-black/60 dark:to-black/35" />
          <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-4 sm:px-8 lg:px-16">
            <div className="grid w-full gap-8 lg:grid-cols-1">
              <div className="space-y-5 sm:space-y-6">
                <p className="text-[11px] font-black tracking-[0.24em] text-primary sm:text-sm sm:tracking-[0.3em]">NANPENGYOU HOTPOT</p>
                <h1 className="max-w-xl text-3xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">{heroSlides[activeSlide].title}</h1>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-100 sm:text-lg">{heroSlides[activeSlide].subtitle}</p>
                <div className="grid gap-3 sm:flex sm:flex-wrap">
                  <Link href="/shop" className="tap-bouncy inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-black text-white transition hover:bg-primary/90">
                    即刻进入商城
                  </Link>
                  <Link href="/delivery" className="tap-bouncy inline-flex h-12 items-center justify-center rounded-xl border border-white/40 bg-white/10 px-6 text-sm font-black text-white backdrop-blur transition hover:bg-white/20">
                    立即点火锅外卖
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:hidden">
                  <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-black tracking-[0.12em] text-primary">SHOP</p>
                    <p className="mt-1 text-sm font-bold text-white">即食汤包</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-black tracking-[0.12em] text-primary">DELIVERY</p>
                    <p className="mt-1 text-sm font-bold text-white">火锅外卖</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {heroSlides.map((slide, index) => (
              <button
                key={slide.title}
                onClick={() => setActiveSlide(index)}
                className={`h-2.5 rounded-full transition-all ${activeSlide === index ? "w-8 bg-primary" : "w-2.5 bg-white/70"}`}
                aria-label={`切换到第${index + 1}张`}
              />
            ))}
          </div>
        </section>

        <section id="brand" className="w-full bg-[color:var(--theme-surface)] py-20 dark:bg-[color:var(--theme-surface)]">
          <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-8 lg:px-16">
            <div className="rounded-2xl border border-primary/20 bg-white p-6 shadow-sm dark:border-primary/30 dark:bg-slate-900/70">
              <p className="text-sm font-black tracking-[0.18em] text-primary">品牌故事</p>
              <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">关于我们</h2>
              <p className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-bold leading-relaxed text-primary">
                “带着家乡沙巴花胶，把滋补做到极致，像男朋友一样宠你。”
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <article className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <div>
                  <p className="text-sm font-black tracking-[0.15em] text-primary">品牌起源</p>
                  <p className="mt-2 text-base font-black text-slate-900 dark:text-slate-100">实现“花胶平民化”，让每个人都吃得起优质花胶。</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    男朋友火锅的创始人 <span className="font-black text-slate-900 dark:text-slate-100">Kelvin</span> 来自沙巴斗湖仙本那（Semporna）。带着家乡最优质、厚实肥美的斗湖花胶，他来到 KL 创业，立志打破“花胶只有贵妇吃得起”的刻板印象。
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    我们深知处理花胶的繁琐：从空运、泡发、去腥到熬制，需耗时超过 48 小时。为了让忙碌的都市人能简单补一补，Kelvin 创立了「男朋友」品牌，由我们包办所有复杂工序，你只需负责享受那一口入嘴即化的胶原蛋白。
                  </p>
                </div>
                <div className="mt-3 overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
                  <Image src={image("/about-us/about-us.JPG")} alt="品牌起源视觉图" width={1200} height={675} className="h-auto w-full" />
                  <p className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">来自沙巴斗湖仙本那优质海域花胶，开启「花胶平民化」初心。</p>
                </div>
              </article>

              <article className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-sm font-black tracking-[0.15em] text-primary">我们的产品核心</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                      <p className="text-sm font-black text-primary">每周新鲜空运</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">严选沙巴斗湖仙本那优质水域花胶，厚实肥美。</p>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                      <p className="text-sm font-black text-primary">匠心熬制</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">每一口汤底都经过 48 小时精密工序，仅需 2 位数价格即可享受东马顶级海域馈赠。</p>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                      <p className="text-sm font-black text-primary">滋补更简单</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">开创马来西亚“鲜炖花胶新时代”，让滋补不再是负担，而是忙碌生活中的小确幸。</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-white p-5 shadow-sm dark:border-primary/30 dark:bg-slate-900/70">
                  <p className="text-sm font-black tracking-[0.15em] text-primary">我们的愿景与使命</p>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
                      <p className="text-xs font-black tracking-[0.08em] text-primary">愿景 Vision</p>
                      <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">成为马来西亚领先的花胶滋补品牌，让高品质花胶走进每一个家庭。</p>
                    </div>
                    <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
                      <p className="text-xs font-black tracking-[0.08em] text-primary">使命 Mission</p>
                      <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">坚持真材实料与创新工艺，把复杂滋补工序变简单，让忙碌生活也能轻松“补一补”。</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-bold text-primary">“来口花胶补一补，忙碌生活也幸福。”</p>
                </div>
              </article>
            </div>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-sm font-black tracking-[0.15em] text-primary">品牌成长路径</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">从一份初心到马来西亚领先的花胶品牌，我们的每一步都印证了对品质的坚持。</p>
              <div className="mt-6 hidden lg:block">
                <div className="relative">
                  <div className="absolute left-0 right-0 top-5 h-px bg-primary/20" />
                  <div className="grid grid-cols-4">
                    <div className="text-center">
                      <span className="mx-auto block h-3 w-3 rounded-full bg-primary" />
                      <p className="mt-2 text-xs font-black text-primary">2021</p>
                    </div>
                    <div className="text-center">
                      <span className="mx-auto block h-3 w-3 rounded-full bg-primary" />
                      <p className="mt-2 text-xs font-black text-primary">2022</p>
                    </div>
                    <div className="text-center">
                      <span className="mx-auto block h-3 w-3 rounded-full bg-primary" />
                      <p className="mt-2 text-xs font-black text-primary">2023</p>
                    </div>
                    <div className="text-center">
                      <span className="mx-auto block h-3 w-3 rounded-full bg-primary" />
                      <p className="mt-2 text-xs font-black text-primary">2024</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">品牌诞生</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">成立男朋友品牌，专注外卖市场，打造爆品「花胶美颜汤」，并设立中央厨房，累积 10,000+ 忠实粉丝。</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">行业革新</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">首创免炖免洗、5 分钟即享汤包；设立自家加工厂，单日销量超 1,000 包，并进入重点连锁超市渠道。</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">旗舰启航</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">首家旗舰店成立，工厂规模突破 10,000 平方英尺，累积 25,000+ 粉丝，迈向马来西亚新滋补时代。</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">全新里程碑</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">进驻 Bloomsvale Shopping Gallery，升级空间美学与服务体验，让花胶火锅成为更具仪式感的生活方式。</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-3 lg:hidden">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-black text-primary">2021</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">品牌诞生</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-black text-primary">2022</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">行业革新</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-black text-primary">2023</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">旗舰启航</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-black text-primary">2024</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">全新里程碑</p>
                </div>
              </div>
            </article>

          </div>
        </section>

        <section id="outlets" className="w-full py-20">
          <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-8 lg:px-16">
            <div className="space-y-2">
              <p className="text-sm font-black tracking-[0.18em] text-primary">餐饮门店</p>
              <h2 className="text-3xl font-black sm:text-4xl">两家分店，不同场景，同样稳定出品</h2>
              <div>
                <Link href="/outlets" className="inline-flex rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                  进入独立门店页
                </Link>
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {outletBranches.map((branch) => (
                <article key={branch.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black tracking-[0.15em] text-primary">{branch.name}</p>
                      <h3 className="mt-1 text-xl font-black">{branch.label}</h3>
                    </div>
                  </div>
                  <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{branch.summary}</p>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <a
                      href={branch.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-black text-primary transition hover:bg-primary/10"
                    >
                      <span className="material-symbols-outlined text-base">map</span>
                      Google Maps
                    </a>
                    <a
                      href={branch.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                    >
                      <span className="material-symbols-outlined text-base">chat</span>
                      WhatsApp订位
                    </a>
                  </div>
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-xl">
                      <div
                        className="flex transition-transform duration-500 ease-out"
                        style={{ transform: `translateX(-${((outletCarouselIndex[branch.id] ?? 0) % branch.photos.length) * 100}%)` }}
                      >
                        {branch.photos.map((photo, index) => (
                          <Image key={photo} src={photo} alt={`${branch.label} 实景 ${index + 1}`} width={1200} height={675} className="h-60 w-full shrink-0 object-cover shadow-sm" />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setOutletCarouselIndex((prev) => ({
                            ...prev,
                            [branch.id]: ((prev[branch.id] ?? 0) - 1 + branch.photos.length) % branch.photos.length,
                          }))
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/65"
                      >
                        <span className="material-symbols-outlined text-base">chevron_left</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOutletCarouselIndex((prev) => ({
                            ...prev,
                            [branch.id]: ((prev[branch.id] ?? 0) + 1) % branch.photos.length,
                          }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/65"
                      >
                        <span className="material-symbols-outlined text-base">chevron_right</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {branch.photos.map((photo, index) => (
                        <button
                          key={photo}
                          type="button"
                          onClick={() => setOutletCarouselIndex((prev) => ({ ...prev, [branch.id]: index }))}
                          className={`overflow-hidden rounded-lg border ${((outletCarouselIndex[branch.id] ?? 0) % branch.photos.length) === index ? "border-primary" : "border-slate-200 dark:border-slate-700"}`}
                        >
                          <Image src={photo} alt={`${branch.label} 缩略图 ${index + 1}`} width={160} height={112} className="h-14 w-20 object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="retail" className="w-full bg-[color:var(--theme-surface)] py-20 dark:bg-[color:var(--theme-surface)]">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 lg:px-16">
            <div className="mb-6 space-y-2">
              <p className="text-sm font-black tracking-[0.18em] text-primary">即食产品</p>
              <h2 className="text-3xl font-black sm:text-4xl">匠心打造，熬制6小时</h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              {retailProducts.map((product) => (
                <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <button type="button" onClick={() => setRetailPreview({ productId: product.id, photoIndex: 0 })} className="group relative block w-full">
                    <Image src={product.photos[0]} alt={`${product.name} 封面`} width={1000} height={1000} className="h-52 w-full bg-white p-2 object-contain transition-transform duration-500 group-hover:scale-105 dark:bg-slate-900/50" />
                    <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[11px] font-black text-white">{product.photos.length} 张</span>
                  </button>
                  <div className="space-y-3 p-4">
                    <h3 className="text-base font-black">{product.name}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {product.keywords.map((keyword) => (
                        <span key={keyword} className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{product.intro}</p>
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                      <p className="text-[11px] font-black tracking-[0.08em] text-primary">推荐人群</p>
                      <p className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">{product.audience}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-sm font-black tracking-[0.15em] text-primary">线下超市渠道</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex h-24 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-white">
                  <Image src={image("/soup-pack/Supermarket/the-food-merchant.png")} alt="The Food Merchant" width={320} height={120} className="h-[95%] w-[95%] object-contain" />
                </div>
                <div className="flex h-24 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-white">
                  <Image src={image("/soup-pack/Supermarket/village-grocer.jpg")} alt="Village Grocer" width={320} height={120} className="h-[95%] w-[95%] object-contain" />
                </div>
                <div className="flex h-24 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-white">
                  <Image src={image("/soup-pack/Supermarket/aeon.jpeg")} alt="AEON" width={320} height={120} className="h-[95%] w-[95%] object-contain" />
                </div>
                <div className="flex h-24 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-white">
                  <Image src={image("/soup-pack/Supermarket/memizooozooo.png")} alt="Memizooozooo" width={320} height={120} className="h-[95%] w-[95%] object-contain" />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/shop" className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90">
                  进入商城选购汤包
                </Link>
                <Link href="/shop/bundles" className="inline-flex items-center rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                  浏览 Bundle Set
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="delivery" className="w-full py-20">
          <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-8 lg:px-16">
            <div className="space-y-3">
              <p className="text-sm font-black tracking-[0.18em] text-primary">火锅外卖</p>
              <h2 className="text-3xl font-black sm:text-4xl">在官网 3 步完成点外卖，配送费先看清再支付</h2>
              <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">从选品到支付都在官网完成，系统会根据配送地址自动计算运费，结账前清楚显示，避免隐藏成本。</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-sm font-black tracking-[0.15em] text-primary">如何在网站点外卖</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-xs font-black text-primary">STEP 1</p>
                    <p className="mt-1 text-sm font-bold">选好商品</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">进入「火锅外卖」页面，把想吃的汤底与食材加入购物车。</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-xs font-black text-primary">STEP 2</p>
                    <p className="mt-1 text-sm font-bold">填写地址</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">输入收货信息后，系统会按配送距离自动计算运费。</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-xs font-black text-primary">STEP 3</p>
                    <p className="mt-1 text-sm font-bold">确认支付</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">确认商品+运费总额后支付，下单后可查看配送状态。</p>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">配送费计算说明</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">配送费按地址与实时路程自动计算，结账前会完整显示。若为较远地区，系统会先展示对应运费，确认后再进入支付流程。</p>
                </div>
              </article>
              <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-sm font-black tracking-[0.15em] text-primary">配送合作方</p>
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <Image src={image("/delivery/Lalamove-Logo.png")} alt="Lalamove 配送合作伙伴" width={1200} height={600} className="h-24 w-full object-contain" />
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">我们与 Lalamove 合作履约配送，覆盖主要城市区域，系统将自动匹配配送距离与费用，并尽量安排最快可配送时段。</p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/delivery" className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90">
                    前往外卖页面
                  </Link>
                  <Link href="/shop" className="inline-flex items-center rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                    改看即食汤包
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="faq" className="w-full bg-[color:var(--theme-surface)] py-20 dark:bg-[color:var(--theme-surface)]">
          <div className="mx-auto w-full max-w-4xl space-y-5 px-4 sm:px-8">
            <p className="text-sm font-black tracking-[0.18em] text-primary">常见问题</p>
            <h2 className="text-3xl font-black sm:text-4xl">你关心的问题，我们先回答</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <Link href="/faq/delivery" className="rounded-xl border border-primary/10 bg-white p-4 text-sm font-black text-slate-900 shadow-sm transition hover:bg-primary/5 dark:bg-slate-900/70 dark:text-slate-100">
                配送 FAQ
              </Link>
              <Link href="/faq/shop" className="rounded-xl border border-primary/10 bg-white p-4 text-sm font-black text-slate-900 shadow-sm transition hover:bg-primary/5 dark:bg-slate-900/70 dark:text-slate-100">
                商城 FAQ
              </Link>
              <Link href="/faq/member" className="rounded-xl border border-primary/10 bg-white p-4 text-sm font-black text-slate-900 shadow-sm transition hover:bg-primary/5 dark:bg-slate-900/70 dark:text-slate-100">
                会员 FAQ
              </Link>
            </div>
            <div className="space-y-3">
              {faqItems.map((item, index) => (
                <details key={item.question} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70" open={index === 0}>
                  <summary className="cursor-pointer text-sm font-black text-slate-900 dark:text-slate-100">{item.question}</summary>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.answer}</p>
                </details>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/faq" className="inline-flex items-center rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                查看 FAQ 导航页
              </Link>
              <Link href="/refund-policy" className="inline-flex items-center rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                查看退款政策
              </Link>
            </div>
          </div>
        </section>

        <section className="w-full bg-white py-10 dark:bg-slate-950/40">
          <div className="mx-auto w-full max-w-7xl space-y-4 px-4 sm:px-8 lg:px-16">
            <div className="rounded-2xl border border-primary/15 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
              <p className="text-[11px] font-black tracking-[0.14em] text-primary">BRAND DEFINITION</p>
              <p className="mt-2 max-w-5xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                男朋友火锅是一个位于马来西亚的多场景火锅品牌，整合门店堂食、火锅外卖与即食花胶汤包零售三条消费路径。
              </p>
            </div>

            <div className="geo-answer-ready rounded-2xl border border-primary/15 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
              <p className="text-[11px] font-black tracking-[0.14em] text-primary">AI ANSWER READY</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {aiAnswerItems.slice(0, 2).map((item) => (
                  <article key={item.question} className="rounded-xl border border-primary/10 bg-primary/5 p-3">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.question}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.answer}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="geo-query-map rounded-2xl border border-primary/15 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
              <p className="text-[11px] font-black tracking-[0.14em] text-primary">AI QUERY MAP</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {homeQueryMapItems.slice(0, 3).map((item) => (
                  <Link
                    key={item.query}
                    href={item.href}
                    className="inline-flex rounded-full border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-black text-primary transition hover:bg-primary/10"
                  >
                    {item.cta}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <UnifiedModal
        open={Boolean(previewProduct)}
        size="xl"
        title={previewProduct?.name ?? ""}
        description="点击左右按钮浏览全部产品图片"
        onClose={() => setRetailPreview(null)}
        actions={
          <button type="button" onClick={() => setRetailPreview(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            关闭
          </button>
        }
      >
        {previewProduct ? (
          <>
            <div className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800/60">
              <Image src={previewProduct.photos[previewIndex]} alt={`${previewProduct.name} 图 ${previewIndex + 1}`} width={1600} height={1200} className="h-[62vh] w-full object-contain" />
              <button
                type="button"
                onClick={() => setRetailPreview({ productId: previewProduct.id, photoIndex: (previewIndex - 1 + previewProduct.photos.length) % previewProduct.photos.length })}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/65"
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={() => setRetailPreview({ productId: previewProduct.id, photoIndex: (previewIndex + 1) % previewProduct.photos.length })}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/65"
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {previewProduct.photos.map((photo, index) => (
                <button key={photo} type="button" onClick={() => setRetailPreview({ productId: previewProduct.id, photoIndex: index })} className={`overflow-hidden rounded-lg border ${previewIndex === index ? "border-primary" : "border-slate-200 dark:border-slate-700"}`}>
                  <Image src={photo} alt={`${previewProduct.name} 缩略图 ${index + 1}`} width={120} height={80} className="h-16 w-24 object-cover" />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </UnifiedModal>
      <Footer />
    </div>
  );
}
