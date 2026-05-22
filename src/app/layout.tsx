import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { LanguageProvider } from "@/components/language-provider";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { assetPath, siteConfig } from "@/lib/site-config";
import { absoluteUrl } from "@/lib/seo";
import "./globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: `${siteConfig.nameWithAlias} | Hotpot, Delivery, Soup Pack in Malaysia`,
    template: `%s | ${siteConfig.nameWithAlias}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  alternates: {
    canonical: absoluteUrl("/"),
    languages: {
      "zh-CN": absoluteUrl("/"),
    },
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.nameWithAlias} | Hotpot, Delivery, Soup Pack in Malaysia`,
    description: siteConfig.description,
    images: [
      {
        url: absoluteUrl(siteConfig.ogImage),
        alt: `${siteConfig.name} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.nameWithAlias} | Hotpot, Delivery, Soup Pack in Malaysia`,
    description: siteConfig.description,
    images: [absoluteUrl(siteConfig.ogImage)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: assetPath("/favicon.png"),
    shortcut: assetPath("/favicon.png"),
    apple: assetPath("/favicon.png"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={siteConfig.languageTag} className="dark">
      <body className={`${body.variable} bg-background-dark font-sans antialiased text-slate-100`}>
        <LanguageProvider>
          {children}
          <MobileBottomNav />
        </LanguageProvider>
      </body>
    </html>
  );
}
