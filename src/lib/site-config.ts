const rawSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://npyhotpot.com").replace(/\/$/, "");
const parsedSiteUrl = new URL(rawSiteUrl);
const siteBasePath = parsedSiteUrl.pathname === "/" ? "" : parsedSiteUrl.pathname.replace(/\/$/, "");

export const siteConfig = {
  name: "Nan Peng You Hotpot",
  displayName: "男朋友火锅",
  nameWithAlias: "Nan Peng You Hotpot (男朋友火锅)",
  aliases: ["男朋友火锅", "NPY Hotpot"],
  legalName: "Go Easy Enterprise (M) Sdn. Bhd.",
  description:
    "Nan Peng You Hotpot (男朋友火锅) brings together dine-in hotpot, hotpot delivery, and ready-to-heat nourishing soup packs in Malaysia.",
  shortDescription: "Hotpot, delivery, and ready-to-heat nourishing soup packs in Malaysia.",
  url: rawSiteUrl,
  origin: parsedSiteUrl.origin,
  basePath: siteBasePath,
  languageTag: "zh-CN",
  locale: "zh_CN",
  phone: "+60 10-936 0866",
  email: "hi@npyhotpot.com",
  address: "3, Jalan Mawar, Seksyen 10, Taman Perindustrian Bukit Serdang, 43300 Seri Kembangan, Selangor, Malaysia",
  ogImage: "/logo.png",
  keywords: [
    "Nan Peng You Hotpot",
    "Malaysia hotpot",
    "hotpot delivery",
    "Seri Kembangan hotpot",
    "fish maw soup",
    "beauty soup",
    "ready to heat soup pack",
    "nourishing soup Malaysia",
  ],
} as const;

export function assetPath(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteConfig.basePath}${normalizedPath}` || normalizedPath;
}

export const publicSitemapRoutes = [
  {
    path: "/",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/about",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/faq",
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    path: "/faq/delivery",
    changeFrequency: "weekly",
    priority: 0.75,
  },
  {
    path: "/faq/shop",
    changeFrequency: "weekly",
    priority: 0.75,
  },
  {
    path: "/faq/member",
    changeFrequency: "weekly",
    priority: 0.75,
  },
  {
    path: "/contact",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/outlets",
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    path: "/terms",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/privacy",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/refund-policy",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/shop",
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    path: "/delivery",
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    path: "/shop/bundles",
    changeFrequency: "weekly",
    priority: 0.8,
  },
] as const;
