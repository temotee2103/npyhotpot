import type { NextConfig } from "next";

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://npyhotpot.com";
const resolvedBasePath = (() => {
  try {
    const pathname = new URL(rawSiteUrl).pathname.replace(/\/$/, "");
    return pathname && pathname !== "/" ? pathname : "";
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  ...(resolvedBasePath
    ? {
        basePath: resolvedBasePath,
        assetPrefix: `${resolvedBasePath}/`,
      }
    : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
