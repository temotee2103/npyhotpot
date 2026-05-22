import Link from "next/link";
import { getFaqTopic } from "@/lib/aeo-content";
import { buildBreadcrumbList, buildFaqPage, buildPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

const topic = getFaqTopic("delivery");

export const metadata = buildPageMetadata({
  title: "Delivery FAQ",
  description: `Delivery FAQ for ${siteConfig.nameWithAlias}: fees, flow, coverage, order timing, and delivery status.`,
  path: "/faq/delivery",
  keywords: [...siteConfig.keywords, "delivery faq", "hotpot delivery faq", "配送 faq"],
  image: siteConfig.ogImage,
});

const structuredData = topic
  ? [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": `${siteConfig.url}/faq/delivery#webpage`,
        url: `${siteConfig.url}/faq/delivery`,
        name: `${siteConfig.nameWithAlias} Delivery FAQ`,
        description: topic.description,
        isPartOf: {
          "@id": `${siteConfig.url}/#website`,
        },
      },
      buildBreadcrumbList(`${siteConfig.url}/faq/delivery#breadcrumb`, [
        { name: "首页", path: "/" },
        { name: "常见问题", path: "/faq" },
        { name: topic.label, path: topic.path },
      ]),
      buildFaqPage(`${siteConfig.url}/faq/delivery#faq`, topic.items),
    ]
  : [];

export default function DeliveryFaqPage() {
  if (!topic) return null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="bg-[color:var(--theme-surface)] py-16 text-[color:var(--foreground)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            <p className="text-sm font-black tracking-[0.16em] text-primary">DELIVERY FAQ</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">{topic.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--theme-muted)]">{topic.intro}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/delivery" className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90">
                前往外卖页
              </Link>
              <Link href="/faq" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                返回 FAQ 导航
              </Link>
              <Link href="/contact" className="rounded-lg border border-[color:var(--theme-border-strong)] px-4 py-2 text-sm font-black hover:bg-black/4 dark:hover:bg-white/6">
                联系客服
              </Link>
            </div>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">先看费用</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">配送费会在付款前显示，用户可先确认总额再继续下单。</p>
            </article>
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">再看状态</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">支付完成不等于配送完成，订单状态会继续同步更新。</p>
            </article>
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">不确定时</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">可先模拟下单查看地址和费用信息，仍有疑问再联系人工协助。</p>
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
