import Link from "next/link";
import { getFaqTopic } from "@/lib/aeo-content";
import { buildBreadcrumbList, buildFaqPage, buildPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

const topic = getFaqTopic("member");

export const metadata = buildPageMetadata({
  title: "Member FAQ",
  description: `Member FAQ for ${siteConfig.nameWithAlias}: registration, points, referrals, coupons, and member center behavior.`,
  path: "/faq/member",
  keywords: [...siteConfig.keywords, "member faq", "membership faq", "会员 faq"],
  image: siteConfig.ogImage,
});

const structuredData = topic
  ? [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": `${siteConfig.url}/faq/member#webpage`,
        url: `${siteConfig.url}/faq/member`,
        name: `${siteConfig.nameWithAlias} Member FAQ`,
        description: topic.description,
        isPartOf: {
          "@id": `${siteConfig.url}/#website`,
        },
      },
      buildBreadcrumbList(`${siteConfig.url}/faq/member#breadcrumb`, [
        { name: "首页", path: "/" },
        { name: "常见问题", path: "/faq" },
        { name: topic.label, path: topic.path },
      ]),
      buildFaqPage(`${siteConfig.url}/faq/member#faq`, topic.items),
    ]
  : [];

export default function MemberFaqPage() {
  if (!topic) return null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="bg-[color:var(--theme-surface)] py-16 text-[color:var(--foreground)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            <p className="text-sm font-black tracking-[0.16em] text-primary">MEMBER FAQ</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">{topic.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--theme-muted)]">{topic.intro}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/member/profile" className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90">
                进入会员中心
              </Link>
              <Link href="/member/referrals" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                查看推荐有礼
              </Link>
              <Link href="/faq" className="rounded-lg border border-[color:var(--theme-border-strong)] px-4 py-2 text-sm font-black hover:bg-black/4 dark:hover:bg-white/6">
                返回 FAQ 导航
              </Link>
            </div>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">先注册</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">商城和外卖结账会先引导登录或注册，方便累计积分和查看订单。</p>
            </article>
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">再看权益</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">会员中心会整合积分、优惠券、订单和推荐记录，减少分散查找成本。</p>
            </article>
            <article className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
              <p className="text-sm font-black text-primary">公开页仍可访问</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">品牌介绍、FAQ、政策页和公开商品页都可先看，不需要先登录。</p>
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
