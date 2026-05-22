import HomePageClient from "@/app/page-client";
import { homeQueryMapItems } from "@/lib/geo-content";
import { buildBreadcrumbList, buildDefinedTermSet, buildFaqPage, buildPageMetadata, normalizeImageUrl } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

export const metadata = buildPageMetadata({
  title: "Hotpot Delivery, Dine-In, and Soup Packs in Malaysia",
  description:
    `Explore ${siteConfig.nameWithAlias} for dine-in hotpot, delivery service, and ready-to-heat nourishing soup packs across Malaysia.`,
  path: "/",
  keywords: [...siteConfig.keywords, "hotpot dine-in", "Malaysia soup delivery"],
  image: siteConfig.ogImage,
});

const faqItems = [
  {
    question: "What is Nan Peng You Hotpot?",
    answer: "Nan Peng You Hotpot is a Malaysia-based hotpot brand that combines dine-in restaurants, hotpot delivery, and ready-to-heat fish maw soup packs in one customer journey.",
  },
  {
    question: "What is the difference between dine-in, delivery, and shop products?",
    answer: "Dine-in is for restaurant hotpot experiences, delivery is for ready-to-eat hotpot meals sent to your address, and the shop is for ready-to-heat soup packs and bundle sets suitable for home stock-up and gifting.",
  },
  {
    question: "What is Nan Peng You Hotpot known for?",
    answer: "The brand is known for fish maw-based nourishing soups, hotpot dining, and a multi-channel model that covers restaurants, delivery, and ready-to-heat retail products.",
  },
];

const aiEntityShortAnswers = [
  {
    name: `${siteConfig.nameWithAlias} brand definition`,
    text: "Nan Peng You Hotpot is a Malaysia hotpot brand that combines dine-in restaurants, hotpot delivery, and ready-to-heat fish maw soup packs.",
  },
  {
    name: `${siteConfig.nameWithAlias} signature offer`,
    text: "Nan Peng You Hotpot is best known for fish maw-based nourishing soups, hotpot dining, and retail soup packs designed for home heating, stock-up, and gifting.",
  },
  {
    name: `${siteConfig.nameWithAlias} buying path`,
    text: "Customers usually choose dine-in for group meals, delivery for ready-to-eat hotpot at home, and the shop for ready-to-heat soup packs or bundle sets.",
  },
];

const homeStructuredData = [
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
    slogan: "带着家乡沙巴花胶，把滋补做到极致，像男朋友一样宠你。",
    email: siteConfig.email,
    telephone: siteConfig.phone,
    founder: {
      "@type": "Person",
      name: "Kelvin",
    },
    areaServed: [
      {
        "@type": "Country",
        name: "Malaysia",
      },
    ],
    availableLanguage: ["zh-CN", "en"],
    knowsAbout: [
      "Hotpot dining",
      "Hotpot delivery",
      "Fish maw soup packs",
      "Nourishing soup",
      "Ready-to-heat soup products",
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address,
      addressCountry: "MY",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    url: siteConfig.url,
    name: siteConfig.name,
    description: siteConfig.description,
    inLanguage: ["zh-CN", "en"],
    publisher: {
      "@id": `${siteConfig.url}/#organization`,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteConfig.url}/shop?keyword={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteConfig.url}/#webpage`,
    url: siteConfig.url,
    name: `${siteConfig.nameWithAlias} Homepage`,
    description: siteConfig.description,
    inLanguage: ["zh-CN", "en"],
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
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".geo-answer-ready", ".geo-query-map"],
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${siteConfig.url}/#restaurant`,
    name: siteConfig.name,
    alternateName: siteConfig.aliases,
    image: [normalizeImageUrl(siteConfig.ogImage)],
    servesCuisine: ["Hotpot", "Chinese"],
    availableLanguage: ["zh-CN", "en"],
    telephone: siteConfig.phone,
    areaServed: "Malaysia",
    brand: {
      "@id": `${siteConfig.url}/#organization`,
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address,
      addressCountry: "MY",
    },
    url: siteConfig.url,
    sameAs: [siteConfig.url],
  },
  buildDefinedTermSet(
    `${siteConfig.url}/#ai-answers`,
    `${siteConfig.nameWithAlias} AI Answer Set`,
    aiEntityShortAnswers.map((item) => ({
      name: item.name,
      description: item.text,
    })),
  ),
  buildDefinedTermSet(
    `${siteConfig.url}/#query-map`,
    `${siteConfig.nameWithAlias} AI Query Map`,
    homeQueryMapItems.map((item) => ({
      name: item.query,
      description: item.answer,
    })),
  ),
  buildBreadcrumbList(`${siteConfig.url}/#breadcrumb`, [{ name: "首页", path: "/" }]),
  buildFaqPage(`${siteConfig.url}/#faq`, faqItems),
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeStructuredData) }}
      />
      <HomePageClient />
    </>
  );
}
