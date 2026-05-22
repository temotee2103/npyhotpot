import type { MetadataRoute } from "next";
import { publicSitemapRoutes, siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const publicAllows = [...publicSitemapRoutes.map((route) => route.path), "/shop/detail", "/shop/bundle"];

  return {
    rules: [
      {
        userAgent: "*",
        allow: publicAllows,
        disallow: [
          "/admin/",
          "/member/",
          "/merchant/",
          "/auth/",
          "/payment/",
          "/shop/checkout",
          "/delivery/checkout",
        ],
      },
      {
        userAgent: ["GPTBot", "ChatGPT-User", "PerplexityBot", "Google-Extended", "ClaudeBot", "OAI-SearchBot"],
        allow: publicAllows,
        disallow: ["/admin/", "/member/", "/merchant/", "/auth/", "/payment/"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: new URL(siteConfig.url).host,
  };
}
