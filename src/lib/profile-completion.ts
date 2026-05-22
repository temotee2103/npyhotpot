"use client";

export type CustomerProfileCompletionShape = {
  full_name: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  address: string | null;
};

export const requiredProfileCompletionFields = ["phone"] as const;

type AddressParts = {
  address1: string;
  address2: string;
  postalCode: string;
  state: string;
  country: string;
};

export function parseStoredAddressParts(raw: string | null | undefined): AddressParts {
  const value = (raw ?? "").trim();
  if (!value) {
    return { address1: "", address2: "", postalCode: "", state: "", country: "" };
  }
  if (value.includes("|")) {
    const [address1 = "", address2 = "", postalCode = "", state = "", country = ""] = value.split("|").map((item) => item.trim());
    return { address1, address2, postalCode, state, country };
  }
  return { address1: value, address2: "", postalCode: "", state: "", country: "" };
}

export function getProfileCompletionMissingFields(profile: CustomerProfileCompletionShape | null | undefined) {
  if (!profile) {
    return [...requiredProfileCompletionFields];
  }
  const missing: string[] = [];

  if (!profile.phone?.trim()) missing.push("phone");

  return missing;
}

export function isProfileComplete(profile: CustomerProfileCompletionShape | null | undefined) {
  return getProfileCompletionMissingFields(profile).length === 0;
}

function parseLocalPath(path: string) {
  const hashless = path.split("#", 1)[0] ?? path;
  const [rawPathname, rawQuery = ""] = hashless.split("?", 2);
  const pathname = rawPathname.endsWith("/") && rawPathname !== "/" ? rawPathname.slice(0, -1) : rawPathname;
  return {
    hashless,
    pathname,
    searchParams: new URLSearchParams(rawQuery),
  };
}

export function isProfileCompletionPath(path?: string | null) {
  if (!path || !path.startsWith("/")) return false;
  return parseLocalPath(path).pathname === "/member/profile";
}

export function normalizeProfileCompletionNext(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) return null;
  const parsed = parseLocalPath(nextPath);
  if (parsed.pathname === "/member/profile") {
    return null;
  }
  return parsed.hashless;
}

export function resolveProfileCompletionDestination(nextPath?: string | null) {
  return normalizeProfileCompletionNext(nextPath) ?? "/member/profile";
}

export function buildProfileCompletionHref(nextPath?: string | null, welcome = false) {
  const params = new URLSearchParams();
  params.set("onboarding", "1");
  if (welcome) {
    params.set("welcome", "1");
  }
  const normalizedNext = normalizeProfileCompletionNext(nextPath);
  if (normalizedNext) {
    params.set("next", normalizedNext);
  }
  return `/member/profile?${params.toString()}`;
}
