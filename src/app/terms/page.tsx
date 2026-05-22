import Link from "next/link";
import { getPolicyDocument, policyDocuments } from "@/lib/aeo-content";
import { buildBreadcrumbList, buildFaqPage, buildPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

const document = getPolicyDocument("terms");

export const metadata = buildPageMetadata({
  title: "Terms and Conditions",
  description: `Official terms and conditions for ${siteConfig.nameWithAlias} website usage, shopping, delivery, and payments.`,
  path: "/terms",
  keywords: [...siteConfig.keywords, "terms and conditions", "条款说明", "website terms"],
  image: siteConfig.ogImage,
});

const structuredData = document
  ? [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${siteConfig.url}/terms#webpage`,
        url: `${siteConfig.url}/terms`,
        name: `${siteConfig.nameWithAlias} Terms and Conditions`,
        description: document.description,
        isPartOf: {
          "@id": `${siteConfig.url}/#website`,
        },
      },
      buildBreadcrumbList(`${siteConfig.url}/terms#breadcrumb`, [
        { name: "首页", path: "/" },
        { name: document.label, path: document.path },
      ]),
      buildFaqPage(`${siteConfig.url}/terms#faq`, document.faqItems),
    ]
  : [];

export default function TermsPage() {
  if (!document) return null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <main className="bg-[color:var(--theme-surface)] py-16 text-[color:var(--foreground)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <section className="rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            <p className="text-sm font-black tracking-[0.16em] text-primary">TERMS</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">{document.label}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--theme-muted)]">{document.intro}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {policyDocuments.map((item) => (
                <Link
                  key={item.slug}
                  href={item.path}
                  className={`rounded-lg px-4 py-2 text-sm font-black ${
                    item.slug === document.slug
                      ? "bg-primary text-white"
                      : "border border-primary/30 text-primary hover:bg-primary/5"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-4">
            {document.faqItems.map((item) => (
              <article key={item.question} className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-slate-900/70">
                <h2 className="text-base font-black">{item.question}</h2>
                <p className="mt-3 text-sm leading-7 text-[color:var(--theme-muted)]">{item.answer}</p>
              </article>
            ))}
          </section>

          <section className="mt-8 space-y-4 rounded-3xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-900/70">
            {document.sections.map((section) => (
              <article key={section.title} className="rounded-2xl border border-primary/10 bg-primary/5 p-5">
                <h2 className="text-lg font-black">{section.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-[color:var(--theme-muted)]">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
