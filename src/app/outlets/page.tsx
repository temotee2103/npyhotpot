import Image from "next/image";
import Link from "next/link";
import { fetchOfficialOutlets } from "@/lib/admin/official-platform";
import { mergeAeoOutlets } from "@/lib/aeo-content";
import { buildBreadcrumbList, buildFaqPage, buildPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

export const metadata = buildPageMetadata({
  title: "Outlets and Restaurant Locations",
  description: `Explore ${siteConfig.nameWithAlias} outlet locations, dining scenarios, contact paths, and official restaurant information.`,
  path: "/outlets",
  keywords: [...siteConfig.keywords, "outlets", "restaurant locations", "男朋友火锅门店"],
  image: siteConfig.ogImage,
});

const outletFaqItems = [
  {
    question: "男朋友火锅有哪些门店？",
    answer: "目前公开展示的官方门店包括 Bloomsvale 分店与 Serdang 分店，用户可按聚餐场景、地理位置和联络方式选择。",
  },
  {
    question: "门店页主要提供什么信息？",
    answer: "门店页会集中整理分店名称、到店场景、Google Maps、WhatsApp 联络方式，以及已同步的地址和营业时间信息。",
  },
  {
    question: "如果营业时间或到店细节不确定怎么办？",
    answer: "建议先查看门店页中的最新信息；若仍需确认，可直接用门店的 WhatsApp 联络官方再安排订位。",
  },
];

export default async function OutletsPage() {
  const officialOutlets = await fetchOfficialOutlets();
  const directoryItems = mergeAeoOutlets(officialOutlets);

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${siteConfig.url}/outlets#webpage`,
      url: `${siteConfig.url}/outlets`,
      name: `${siteConfig.nameWithAlias} Outlets`,
      description: "Official outlet directory for dine-in hotpot locations and store contact paths.",
      isPartOf: {
        "@id": `${siteConfig.url}/#website`,
      },
      hasPart: directoryItems.map((item) => ({
        "@type": "Restaurant",
        "@id": `${siteConfig.url}/outlets#${item.id}`,
        name: item.name,
        description: item.summary,
        telephone: siteConfig.phone,
        openingHours: item.operatingHours ?? undefined,
        address: item.location
          ? {
              "@type": "PostalAddress",
              streetAddress: item.location,
              addressCountry: "MY",
            }
          : undefined,
        sameAs: item.mapsUrl || undefined,
      })),
    },
    buildBreadcrumbList(`${siteConfig.url}/outlets#breadcrumb`, [
      { name: "首页", path: "/" },
      { name: "门店页", path: "/outlets" },
    ]),
    buildFaqPage(`${siteConfig.url}/outlets#faq`, outletFaqItems),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="bg-[color:var(--theme-surface)] py-16 text-[color:var(--foreground)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            <p className="text-sm font-black tracking-[0.16em] text-primary">OUTLETS</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">官方门店页</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--theme-muted)]">
              这是一页专门给用户、搜索引擎和 AI 系统理解门店分布的公开页。你可以在这里快速判断哪一家分店更适合聚餐、就近用餐或先联系确认订位。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/about" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                查看品牌介绍
              </Link>
              <Link href="/delivery" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                需要外卖
              </Link>
              <Link href="/contact" className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90">
                联系官方
              </Link>
            </div>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">公开可索引</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">门店页独立存在，方便搜索引擎和 AI 直接理解品牌线下门店分布。</p>
            </article>
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">先看场景</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">每家分店都附带适合场景说明，降低用户只看到名字却不知道怎么选的问题。</p>
            </article>
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">再看联系路径</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">Google Maps 与 WhatsApp 入口都放在门店卡片内，方便马上导航或预约。</p>
            </article>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            {directoryItems.map((branch) => (
              <article
                key={branch.id}
                id={branch.id}
                className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black tracking-[0.15em] text-primary">{branch.name}</p>
                    <h2 className="mt-1 text-2xl font-black">{branch.label}</h2>
                  </div>
                  {branch.isActive ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                      官方门店
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-7 text-[color:var(--theme-muted)]">{branch.summary}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                    <p className="text-xs font-black tracking-[0.12em] text-primary">LOCATION</p>
                    <p className="mt-2 text-sm leading-7">{branch.location ?? "如需最新地址细节，请先查看 Google Maps 或通过门店 WhatsApp 联系确认。"}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                    <p className="text-xs font-black tracking-[0.12em] text-primary">OPERATING HOURS</p>
                    <p className="mt-2 text-sm leading-7">{branch.operatingHours ?? "营业时间以门店最新安排为准，建议到店前先联络确认。"}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {branch.serviceHighlights.map((item) => (
                    <span key={item} className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-black text-primary">
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {branch.mapsUrl ? (
                    <a
                      href={branch.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-black text-primary transition hover:bg-primary/10"
                    >
                      <span className="material-symbols-outlined text-base">map</span>
                      Google Maps
                    </a>
                  ) : null}
                  {branch.whatsappUrl ? (
                    <a
                      href={branch.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                    >
                      <span className="material-symbols-outlined text-base">chat</span>
                      WhatsApp 咨询
                    </a>
                  ) : null}
                </div>

                {branch.photos.length > 0 ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {branch.photos.map((photo, index) => (
                      <div key={photo} className="overflow-hidden rounded-2xl border border-primary/10">
                        <Image
                          src={photo}
                          alt={`${branch.label} 实景 ${index + 1}`}
                          width={1200}
                          height={900}
                          className="h-52 w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </section>

          <section className="mt-8 grid gap-4">
            {outletFaqItems.map((item) => (
              <article key={item.question} className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
                <h2 className="text-base font-black">{item.question}</h2>
                <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">{item.answer}</p>
              </article>
            ))}
          </section>

          <section className="mt-8 rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            <h2 className="text-2xl font-black">门店与线上服务怎么选</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                <p className="text-sm font-black">想聚餐</p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--theme-muted)]">优先看门店页，按地理位置、场景和联络方式决定去哪一家分店。</p>
              </article>
              <article className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                <p className="text-sm font-black">想马上在家吃</p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--theme-muted)]">改到外卖页下单，系统会在结账前显示配送费。</p>
              </article>
              <article className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                <p className="text-sm font-black">想囤货或送礼</p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--theme-muted)]">改看商城与 Bundle Set，选择可保存、可回家加热的商品。</p>
              </article>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
