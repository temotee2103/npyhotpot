import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Shop Hotpot Soup Packs",
  description:
    `Browse ${siteConfig.nameWithAlias} soup packs, nourishing broths, and ready-to-heat hotpot essentials for home dining in Malaysia.`,
  alternates: {
    canonical: "/shop",
    languages: {
      "zh-CN": "/shop",
    },
  },
  openGraph: {
    url: `${siteConfig.url}/shop`,
    title: `Shop Hotpot Soup Packs | ${siteConfig.nameWithAlias}`,
    description:
      `Browse ${siteConfig.nameWithAlias} soup packs, nourishing broths, and ready-to-heat hotpot essentials for home dining in Malaysia.`,
    images: [
      {
        url: siteConfig.ogImage,
        alt: `${siteConfig.name} shop`,
      },
    ],
  },
};

export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
