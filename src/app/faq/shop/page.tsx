import Link from "next/link";
import { getFaqTopic } from "@/lib/aeo-content";
import { buildBreadcrumbList, buildFaqPage, buildPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

const topic = getFaqTopic("shop");

export const metadata = buildPageMetadata({
  title: "Shop FAQ",
  description: `Shop FAQ for ${siteConfig.nameWithAlias}: soup packs, heating, storage, bundle sets, and buying choices.`,
  path: "/faq/shop",
  keywords: [...siteConfig.keywords, "shop faq", "soup pack faq", "商城 faq"],
  image: siteConfig.ogImage,
});

const structuredData = topic
  ? [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": `${siteConfig.url}/faq/shop#webpage`,
        url: `${siteConfig.url}/faq/shop`,
        name: `${siteConfig.nameWithAlias} Shop FAQ`,
        description: topic.description,
        isPartOf: {
          "@id": `${siteConfig.url}/#website`,
        },
      },
      buildBreadcrumbList(`${siteConfig.url}/faq/shop#breadcrumb`, [
        { name: "首页", path: "/" },
        { name: "常见问题", path: "/faq" },
        { name: topic.label, path: topic.path },
      ]),
      buildFaqPage(`${siteConfig.url}/faq/shop#faq`, topic.items),
    ]
  : [];

export default function ShopFaqPage() {
  if (!topic) return null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="bg-[color:var(--theme-surface)] py-16 text-[color:var(--foreground)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            <p className="text-sm font-black tracking-[0.16em] text-primary">SHOP FAQ</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">{topic.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--theme-muted)]">{topic.intro}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/shop" className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90">
                进入商城
              </Link>
              <Link href="/shop/bundles" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                查看 Bundle Set
              </Link>
              <Link href="/faq" className="rounded-lg border border-[color:var(--theme-border-strong)] px-4 py-2 text-sm font-black hover:bg-black/4 dark:hover:bg-white/6">
                返回 FAQ 导航
              </Link>
            </div>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">先分场景</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">要即食到家看外卖，要囤货或送礼看商城，要一次买多款看 Bundle Set。</p>
            </article>
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">再看商品页</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">商品页会说明加热方法、保存方式、适合谁买和购买前注意事项。</p>
            </article>
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">最后做判断</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">如果只是补某一款口味，单品更直接；若是多人备料或礼赠，套餐更省判断时间。</p>
            </article>
          </section>

          <section className="mt-8 grid gap-4">
            {topic.items.map((item, index) => (
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
