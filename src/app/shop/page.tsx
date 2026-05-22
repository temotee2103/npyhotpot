import ShopPageClient from "@/app/shop/page-client";
import { fetchOfficialBundles, fetchOfficialSoupPackVariants } from "@/lib/admin/official-shop";
import { buildBreadcrumbList, buildFaqPage, buildPageMetadata, mergeImageUrls, normalizeImageUrl } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

export const metadata = buildPageMetadata({
  title: "Shop Hotpot Soup Packs",
  description:
    `Browse ${siteConfig.nameWithAlias} soup packs, bundle sets, and ready-to-heat hotpot essentials for home dining in Malaysia.`,
  path: "/shop",
  keywords: [...siteConfig.keywords, "shop soup packs", "hotpot bundle set"],
  image: siteConfig.ogImage,
});

const shopFaqItems = [
  {
    question: "男朋友火锅商城卖什么？",
    answer: "商城主要销售可在家加热食用的花胶汤包、火锅汤底与 Bundle Set，适合家庭备餐、送礼与日常补货。",
  },
  {
    question: "什么时候该选商城，而不是火锅外卖？",
    answer: "如果你要购买可囤货、可冷冻保存、适合自己加热的商品，应选商城；如果你要现煮火锅、配料和即点即送服务，应改到火锅外卖页面。",
  },
  {
    question: "商城下单前要确认哪些信息？",
    answer: "建议先确认商品类型、币种价格、收货地址与配送费用；若想减少选择时间，可直接浏览 Bundle Set 页面挑选组合。",
  },
];

export default async function ShopPage() {
  const [variants, bundles] = await Promise.all([fetchOfficialSoupPackVariants(), fetchOfficialBundles()]);

  const activeVariants = variants.filter((item) => item.status === "active");
  const activeBundles = bundles.filter((item) => item.status === "active");

  const shopStructuredData = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${siteConfig.url}/shop#collection`,
      url: `${siteConfig.url}/shop`,
      name: `${siteConfig.nameWithAlias} Shop`,
      description: "Shop soup packs, hotpot bundles, and ready-to-heat hotpot products.",
      isPartOf: {
        "@id": `${siteConfig.url}/#website`,
      },
    },
    buildBreadcrumbList(`${siteConfig.url}/shop#breadcrumb`, [
      { name: "首页", path: "/" },
      { name: "商城", path: "/shop" },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${siteConfig.url}/shop#products`,
      name: "Shop Products",
      itemListElement: activeVariants.slice(0, 16).map((item, index) => ({
        "@type": "Product",
        position: index + 1,
        name: item.title,
        description: item.subtitle ?? item.usage_text ?? "Ready-to-heat soup pack",
        sku: item.sku,
        image: mergeImageUrls(item.image_url, item.images),
        url: `${siteConfig.url}/shop/detail?id=${encodeURIComponent(item.id)}`,
        brand: {
          "@type": "Brand",
          name: siteConfig.name,
        },
        offers: Object.entries(item.prices).map(([currency, price]) => ({
          "@type": "Offer",
          priceCurrency: currency,
          price: Number(price ?? 0).toFixed(2),
          availability: item.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: `${siteConfig.url}/shop/detail?id=${encodeURIComponent(item.id)}`,
        })),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${siteConfig.url}/shop#bundles`,
      name: "Shop Bundles",
      itemListElement: activeBundles.slice(0, 12).map((item, index) => ({
        "@type": "Product",
        position: index + 1,
        name: item.title,
        image: [normalizeImageUrl(item.image_url)],
        url: `${siteConfig.url}/shop/bundle?id=${encodeURIComponent(item.id)}`,
        category: "Bundle Set",
        brand: {
          "@type": "Brand",
          name: siteConfig.name,
        },
      })),
    },
    buildFaqPage(`${siteConfig.url}/shop#faq`, shopFaqItems),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(shopStructuredData) }}
      />
      <ShopPageClient />
    </>
  );
}
