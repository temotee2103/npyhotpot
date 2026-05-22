import type { Metadata } from "next";
import { Suspense } from "react";
import ShopBundleDetailPageClient from "@/app/shop/bundle/page-client";
import { buildPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: "Bundle Set",
    description: `Bundle detail page for ${siteConfig.nameWithAlias} shop sets.`,
    path: "/shop/bundle",
    keywords: [...siteConfig.keywords, "bundle set"],
    image: siteConfig.ogImage,
    noindex: true,
  });
}

export default function ShopBundlePage() {
  return (
    <Suspense fallback={null}>
      <ShopBundleDetailPageClient />
    </Suspense>
  );
}
