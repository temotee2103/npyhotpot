import type { MetadataRoute } from "next";
import { fetchOfficialBundles, fetchOfficialSoupPackVariants } from "@/lib/admin/official-shop";
import { publicSitemapRoutes, siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [variants, bundles] = await Promise.all([fetchOfficialSoupPackVariants(), fetchOfficialBundles()]);

  const productRoutes = variants
    .filter((item) => item.status === "active")
    .map((item) => ({
      url: `${siteConfig.url}/shop/detail?id=${encodeURIComponent(item.id)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  const bundleRoutes = bundles
    .filter((item) => item.status === "active")
    .map((item) => ({
      url: `${siteConfig.url}/shop/bundle?id=${encodeURIComponent(item.id)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [
    ...publicSitemapRoutes.map((route) => ({
      url: `${siteConfig.url}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...productRoutes,
    ...bundleRoutes,
  ];
}
