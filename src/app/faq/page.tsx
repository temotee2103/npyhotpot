import Link from "next/link";
import { faqHubItems, faqTopics } from "@/lib/aeo-content";
import { buildBreadcrumbList, buildFaqPage, buildPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

export const metadata = buildPageMetadata({
  title: "Hotpot FAQ and Buying Guide",
  description:
    `Get fast answers about ${siteConfig.nameWithAlias} delivery, soup packs, membership, heating steps, and ordering choices.`,
  path: "/faq",
  keywords: [...siteConfig.keywords, "hotpot faq", "nan peng you hotpot faq", "hotpot delivery questions"],
  image: siteConfig.ogImage,
});

const faqStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${siteConfig.url}/faq#webpage`,
    url: `${siteConfig.url}/faq`,
    name: `${siteConfig.nameWithAlias} FAQ`,
    description: "Frequently asked questions about hotpot delivery, soup packs, and membership.",
    isPartOf: {
      "@id": `${siteConfig.url}/#website`,
    },
  },
  buildBreadcrumbList(`${siteConfig.url}/faq#breadcrumb`, [
    { name: "首页", path: "/" },
    { name: "常见问题", path: "/faq" },
  ]),
  buildFaqPage(`${siteConfig.url}/faq#faq`, faqHubItems),
];

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <main className="bg-[color:var(--theme-surface)] py-16 text-[color:var(--foreground)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            <p className="text-sm font-black tracking-[0.16em] text-primary">FAQ</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">常见问题与快速答案</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--theme-muted)]">
              这一页现在作为 FAQ 导航入口，先帮助用户快速判断问题属于配送、商城还是会员，再进入对应专题页获取更完整的答案块。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/about" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                查看品牌介绍
              </Link>
              <Link href="/outlets" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                查看门店页
              </Link>
              <Link href="/shop" className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90">
                浏览商城
              </Link>
              <Link href="/delivery" className="rounded-lg border border-[color:var(--theme-border-strong)] px-4 py-2 text-sm font-black hover:bg-black/4 dark:hover:bg-white/6">
                进入外卖
              </Link>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {faqTopics.map((topic) => (
              <article key={topic.slug} className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
                <p className="text-sm font-black tracking-[0.14em] text-primary">{topic.label}</p>
                <h2 className="mt-3 text-xl font-black">{topic.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">{topic.intro}</p>
                <div className="mt-4 space-y-2 text-xs text-[color:var(--theme-muted)]">
                  {topic.items.slice(0, 3).map((item) => (
                    <p key={item.question} className="rounded-2xl border border-primary/10 bg-primary/5 px-3 py-2">
                      {item.question}
                    </p>
                  ))}
                </div>
                <Link
                  href={topic.path}
                  className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90"
                >
                  进入{topic.label}
                </Link>
              </article>
            ))}
          </section>

          <section className="mt-8 grid gap-4">
            {faqHubItems.map((item, index) => (
              <details
                key={item.question}
                className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70"
                open={index < 2}
              >
                <summary className="cursor-pointer text-base font-black">{item.question}</summary>
                <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">{item.answer}</p>
              </details>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
