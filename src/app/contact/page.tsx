import Link from "next/link";
import { buildBreadcrumbList, buildFaqPage, buildPageMetadata, normalizeImageUrl } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

export const metadata = buildPageMetadata({
  title: "Contact Nan Peng You Hotpot",
  description:
    `Contact ${siteConfig.nameWithAlias} for ordering support, brand inquiries, membership help, and delivery questions in Malaysia.`,
  path: "/contact",
  keywords: [...siteConfig.keywords, "contact nan peng you hotpot", "hotpot contact malaysia"],
  image: siteConfig.ogImage,
});

const contactFaqItems = [
  {
    question: "男朋友火锅的联系方式是什么？",
    answer: `你可以通过电话 ${siteConfig.phone} 或电邮 ${siteConfig.email} 联系我们。`,
  },
  {
    question: "适合咨询哪些问题？",
    answer: "常见咨询包括订单问题、商品选择、配送疑问、会员积分、推荐活动，以及品牌合作相关事项。",
  },
  {
    question: "如果我想马上下单，应该联系还是直接去页面？",
    answer: "如果你已经知道自己要买什么，建议直接进入商城或外卖页面下单；若需要人工协助，再通过电话或邮件联系。",
  },
];

const contactStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${siteConfig.url}/contact#webpage`,
    url: `${siteConfig.url}/contact`,
    name: `Contact ${siteConfig.nameWithAlias}`,
    description: "Official contact information and support paths for Nan Peng You Hotpot.",
    isPartOf: {
      "@id": `${siteConfig.url}/#website`,
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
    telephone: siteConfig.phone,
    email: siteConfig.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address,
      addressCountry: "MY",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: siteConfig.phone,
        email: siteConfig.email,
        areaServed: "MY",
        availableLanguage: ["zh-CN", "en"],
      },
    ],
  },
  buildBreadcrumbList(`${siteConfig.url}/contact#breadcrumb`, [
    { name: "首页", path: "/" },
    { name: "联系我们", path: "/contact" },
  ]),
  buildFaqPage(`${siteConfig.url}/contact#faq`, contactFaqItems),
];

const contactCards = [
  {
    title: "客服电话",
    value: siteConfig.phone,
    note: "适合订单、配送、会员和商品咨询",
  },
  {
    title: "联系邮箱",
    value: siteConfig.email,
    note: "适合合作、品牌、客服与问题反馈",
  },
  {
    title: "公司主体",
    value: siteConfig.legalName,
    note: "官方登记主体信息",
  },
  {
    title: "联系地址",
    value: siteConfig.address,
    note: "可用于品牌与主体识别",
  },
];

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactStructuredData) }}
      />
      <main className="bg-[color:var(--theme-surface)] py-16 text-[color:var(--foreground)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 sm:px-8">
          <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            <p className="text-sm font-black tracking-[0.16em] text-primary">CONTACT</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">联系我们</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--theme-muted)]">
              如果你需要订单协助、配送说明、会员积分帮助、品牌合作资讯，或只是想先确认该选商城还是外卖，可以通过下面的官方联系方式与我们联系。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/faq" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-black text-primary hover:bg-primary/5">
                先看常见问答
              </Link>
              <Link href="/shop" className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:bg-primary/90">
                进入商城
              </Link>
              <Link href="/delivery" className="rounded-lg border border-[color:var(--theme-border-strong)] px-4 py-2 text-sm font-black hover:bg-black/4 dark:hover:bg-white/6">
                订火锅外卖
              </Link>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {contactCards.map((card) => (
              <article key={card.title} className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
                <p className="text-sm font-black tracking-[0.12em] text-primary">{card.title}</p>
                <p className="mt-3 text-lg font-black">{card.value}</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--theme-muted)]">{card.note}</p>
              </article>
            ))}
          </section>

          <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            <h2 className="text-2xl font-black">联系前常见问题</h2>
            <div className="mt-4 space-y-4">
              {contactFaqItems.map((item) => (
                <article key={item.question} className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                  <h3 className="text-sm font-black">{item.question}</h3>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--theme-muted)]">{item.answer}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
