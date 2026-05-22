import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Hotpot Delivery",
  description:
    `Order ${siteConfig.nameWithAlias} delivery for hotpot sets, ingredients, and nourishing soup bases prepared for customers in Malaysia.`,
  alternates: {
    canonical: "/delivery",
    languages: {
      "zh-CN": "/delivery",
    },
  },
  openGraph: {
    url: `${siteConfig.url}/delivery`,
    title: `Hotpot Delivery | ${siteConfig.nameWithAlias}`,
    description:
      `Order ${siteConfig.nameWithAlias} delivery for hotpot sets, ingredients, and nourishing soup bases prepared for customers in Malaysia.`,
    images: [
      {
        url: siteConfig.ogImage,
        alt: `${siteConfig.name} delivery`,
      },
    ],
  },
};

export default function DeliveryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
