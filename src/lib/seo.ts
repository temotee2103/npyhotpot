import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

type BuildMetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  image?: string | null;
  noindex?: boolean;
  type?: "website" | "article";
};

type BreadcrumbItem = {
  name: string;
  path: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type DefinedTermItem = {
  name: string;
  description: string;
};

type HowToStepItem = {
  name: string;
  text: string;
};

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteConfig.url}${normalizedPath}`;
}

export function normalizeImageUrl(image?: string | null) {
  const source = (image ?? "").trim() || siteConfig.ogImage;
  return /^https?:\/\//i.test(source) ? source : absoluteUrl(source);
}

export function dedupeStrings(values: Array<string | null | undefined>) {
  return values
    .map((value) => (value ?? "").trim())
    .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);
}

export function mergeImageUrls(primary?: string | null, extra?: string[] | null) {
  return dedupeStrings([primary, ...(extra ?? [])]).map((item) => normalizeImageUrl(item));
}

export function getFirstSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function buildPageMetadata({
  title,
  description,
  path,
  keywords,
  image,
  noindex = false,
  type = "website",
}: BuildMetadataInput): Metadata {
  const canonical = path.startsWith("/") ? path : `/${path}`;
  const canonicalUrl = absoluteUrl(canonical);
  const fullTitle = `${title} | ${siteConfig.name}`;
  const imageUrl = normalizeImageUrl(image);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        [siteConfig.languageTag]: canonicalUrl,
      },
    },
    openGraph: {
      type,
      locale: siteConfig.locale,
      url: absoluteUrl(canonical),
      siteName: siteConfig.name,
      title: fullTitle,
      description,
      images: [
        {
          url: imageUrl,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [imageUrl],
    },
    robots: noindex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : undefined,
  };
}

export function buildBreadcrumbList(id: string, items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": id,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildFaqPage(id: string, items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": id,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildDefinedTermSet(id: string, name: string, items: DefinedTermItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": id,
    name,
    hasDefinedTerm: items.map((item) => ({
      "@type": "DefinedTerm",
      name: item.name,
      description: item.description,
      inDefinedTermSet: id,
    })),
  };
}

export function buildHowTo(id: string, name: string, description: string, steps: HowToStepItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": id,
    name,
    description,
    step: steps.map((item, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: item.name,
      text: item.text,
    })),
  };
}
