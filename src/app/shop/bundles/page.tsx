import ShopBundlesPageClient from "@/app/shop/bundles/page-client";
import { fetchOfficialBundles } from "@/lib/admin/official-shop";
import { buildBreadcrumbList, buildPageMetadata, normalizeImageUrl } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

export const metadata = buildPageMetadata({
  title: "Hotpot Bundle Sets",
  description:
    "Browse Nan Peng You Hotpot bundle sets for curated ready-to-heat soup pack combinations and promotional bundle offers.",
  path: "/shop/bundles",
  keywords: [...siteConfig.keywords, "bundle set", "shop bundles"],
  image: siteConfig.ogImage,
});

export default async function ShopBundlesPage() {
  const bundles = (await fetchOfficialBundles()).filter((item) => item.status === "active");

  const bundlesStructuredData = [
    buildBreadcrumbList(`${siteConfig.url}/shop/bundles#breadcrumb`, [
      { name: "首页", path: "/" },
      { name: "商城", path: "/shop" },
      { name: "Bundle Set", path: "/shop/bundles" },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${siteConfig.url}/shop/bundles#list`,
      name: "Hotpot Bundle Sets",
      itemListElement: bundles.map((item, index) => ({
        "@type": "Product",
        position: index + 1,
        name: item.title,
        image: [normalizeImageUrl(item.image_url)],
        category: "Bundle Set",
        url: `${siteConfig.url}/shop/bundle?id=${encodeURIComponent(item.id)}`,
        brand: {
          "@type": "Brand",
          name: siteConfig.name,
        },
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bundlesStructuredData) }}
      />
      <ShopBundlesPageClient />
    </>
  );
}
