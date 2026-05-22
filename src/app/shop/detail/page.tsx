import type { Metadata } from "next";
import { Suspense } from "react";
import ShopDetailPageClient from "@/app/shop/detail/page-client";
import { buildPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "Shop Product",
    description: `Product detail page for ${siteConfig.nameWithAlias} shop items.`,
    path: "/shop/detail",
    keywords: [...siteConfig.keywords, "shop product", "soup pack"],
    image: siteConfig.ogImage,
    noindex: true,
  });
}

export default function ShopDetailPage() {
  return (
    <Suspense fallback={null}>
      <ShopDetailPageClient />
    </Suspense>
  );
}
