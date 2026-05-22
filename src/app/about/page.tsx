import Link from "next/link";
import { buildBreadcrumbList, buildFaqPage, buildPageMetadata, normalizeImageUrl } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

export const metadata = buildPageMetadata({
  title: "About Nan Peng You Hotpot",
  description:
    `${siteConfig.nameWithAlias} is a Malaysia hotpot brand offering dine-in, hotpot delivery, and ready-to-heat nourishing soup packs.`,
  path: "/about",
  keywords: [...siteConfig.keywords, "about nan peng you hotpot", "hotpot brand malaysia"],
  image: siteConfig.ogImage,
});

const aboutFaqItems = [
  {
    question: "男朋友火锅是什么品牌？",
    answer: "男朋友火锅是马来西亚火锅品牌，业务覆盖门店堂食、官网火锅外卖，以及适合居家加热的花胶汤包与礼盒商品。",
  },
  {
    question: "男朋友火锅主要卖什么？",
    answer: "核心产品包括火锅堂食体验、可配送到家的火锅外卖，以及可冷冻保存、回家加热即可食用的滋补汤包和组合套装。",
  },
  {
    question: "什么时候该选商城，什么时候该选外卖？",
    answer: "如果你要即点即吃、连食材和汤底一起配送，适合选外卖；如果你要囤货、送礼或在家慢慢加热食用，适合选商城汤包和礼盒。",
  },
];

const aboutStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${siteConfig.url}/about#webpage`,
    url: `${siteConfig.url}/about`,
    name: `About ${siteConfig.nameWithAlias}`,
    description: `${siteConfig.nameWithAlias} brand overview, products, and service channels in Malaysia.`,
    isPartOf: {
      "@id": `${siteConfig.url}/#website`,
    },
    about: {
      "@id": `${siteConfig.url}/#organization`,
    },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: normalizeImageUrl(siteConfig.ogImage),
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    alternateName: siteConfig.aliases,
    legalName: siteConfig.legalName,
    url: siteConfig.url,
    logo: normalizeImageUrl(siteConfig.ogImage),
    description: siteConfig.description,
    telephone: siteConfig.phone,
    email: siteConfig.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address,
      addressCountry: "MY",
    },
  },
  buildBreadcrumbList(`${siteConfig.url}/about#breadcrumb`, [
    { name: "首页", path: "/" },
    { name: "关于我们", path: "/about" },
  ]),
  buildFaqPage(`${siteConfig.url}/about#faq`, aboutFaqItems),
];

const brandFacts = [
  "品牌主名称：Nan Peng You Hotpot（男朋友火锅）",
  "品牌定位：马来西亚火锅品牌，覆盖堂食、外卖与可加热汤包零售",
  "核心特色：花胶滋补汤、火锅用餐体验、官网直接下单",
  "适用场景：家庭聚餐、办公室订餐、备餐囤货、送礼",
];

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutStructuredData) }}
      />
      <main className="bg-[color:var(--theme-surface)] py-16 text-[color:var(--foreground)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 sm:px-8">
          <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            <p className="text-sm font-black tracking-[0.16em] text-primary">ABOUT</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">关于男朋友火锅</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--theme-muted)]">
              男朋友火锅是马来西亚火锅品牌，整合了门店堂食、官网火锅外卖，以及可在家加热的花胶汤包与组合礼盒，方便用户根据聚餐、即食、囤货或送礼场景做选择。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/shop" className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90">
                进入商城
              </Link>
              <Link href="/delivery" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                订火锅外卖
              </Link>
              <Link href="/faq" className="rounded-lg border border-[color:var(--theme-border-strong)] px-4 py-2 text-sm font-black hover:bg-black/4 dark:hover:bg-white/6">
                查看常见问答
              </Link>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
              <h2 className="text-2xl font-black">品牌速览</h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--theme-muted)]">
                {brandFacts.map((fact) => (
                  <li key={fact} className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3">
                    {fact}
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
              <h2 className="text-2xl font-black">怎么选择服务渠道</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-[color:var(--theme-muted)]">
                <div className="rounded-2xl border border-primary/10 p-4">
                  <p className="font-black text-[color:var(--foreground)]">堂食</p>
                  <p className="mt-2">适合聚餐、约会和现场享受火锅用餐体验。</p>
                </div>
                <div className="rounded-2xl border border-primary/10 p-4">
                  <p className="font-black text-[color:var(--foreground)]">外卖</p>
                  <p className="mt-2">适合即点即送、当餐就吃，结账前可先看到配送费用。</p>
                </div>
                <div className="rounded-2xl border border-primary/10 p-4">
                  <p className="font-black text-[color:var(--foreground)]">商城</p>
                  <p className="mt-2">适合囤货、送礼、家庭备餐，以及购买可冷冻保存的花胶汤包与礼盒。</p>
                </div>
              </div>
            </article>
          </section>

          <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            <p className="text-sm font-black tracking-[0.16em] text-primary">AEO QUICK ANSWERS</p>
            <h2 className="mt-3 text-2xl font-black">关于品牌的快速答案</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {aboutFaqItems.map((item) => (
                <article key={item.question} className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <h3 className="text-sm font-black">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--theme-muted)]">{item.answer}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
