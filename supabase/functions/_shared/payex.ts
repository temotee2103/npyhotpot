type PayexConfig = {
  apiBaseUrl: string;
  basicAuthHeader: string;
  signatureSecret: string;
  callbackUrl: string;
  defaultShopReturnUrl: string;
  defaultDeliveryReturnUrl: string;
};

let cachedToken: { token: string; expiresAtMs: number } | null = null;

function getPayexConfig(): PayexConfig | null {
  const apiBaseUrl = Deno.env.get("PAYEX_API_BASE_URL") ?? "https://api.payex.io";
  const basicAuthHeaderFromEnv = Deno.env.get("PAYEX_BASIC_AUTH_HEADER") ?? "";
  const basicUsername = Deno.env.get("PAYEX_BASIC_USERNAME") ?? "";
  const basicPassword = Deno.env.get("PAYEX_BASIC_PASSWORD") ?? "";
  const signatureSecret = Deno.env.get("PAYEX_SIGNATURE_SECRET") ?? "";
  const callbackUrl = Deno.env.get("PAYEX_CALLBACK_URL") ?? "";
  const defaultShopReturnUrl = Deno.env.get("PAYEX_RETURN_URL_SHOP") ?? "";
  const defaultDeliveryReturnUrl = Deno.env.get("PAYEX_RETURN_URL_DELIVERY") ?? "";

  const derivedBasicHeader =
    basicAuthHeaderFromEnv ||
    (basicUsername && basicPassword ? `Basic ${btoa(`${basicUsername}:${basicPassword}`)}` : "");
  if (!derivedBasicHeader) return null;

  return {
    apiBaseUrl,
    basicAuthHeader: derivedBasicHeader,
    signatureSecret,
    callbackUrl,
    defaultShopReturnUrl,
    defaultDeliveryReturnUrl,
  };
}

function toIsoTimeMs(dateText: string | null | undefined) {
  if (!dateText) return 0;
  const value = new Date(dateText).getTime();
  return Number.isFinite(value) ? value : 0;
}

export async function getPayexBearerToken(): Promise<{ ok: true; token: string; expiresAtMs: number } | { ok: false; message: string }> {
  const config = getPayexConfig();
  if (!config) return { ok: false, message: "Payex auth config missing" };

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - now > 30_000) {
    return { ok: true, token: cachedToken.token, expiresAtMs: cachedToken.expiresAtMs };
  }

  const response = await fetch(`${config.apiBaseUrl}/api/Auth/Token`, {
    method: "POST",
    headers: {
      Authorization: config.basicAuthHeader,
      "Content-Type": "application/json",
    },
  });
  const raw = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  if (!response.ok) {
    const message = typeof parsed?.message === "string" ? parsed.message : `Payex token error ${response.status}`;
    return { ok: false, message };
  }

  const token = typeof parsed?.token === "string" ? parsed.token : "";
  if (!token) return { ok: false, message: "Payex token missing in response" };
  const expiresAtMs = toIsoTimeMs(typeof parsed?.expiration === "string" ? parsed.expiration : null) || now + 10 * 60_000;
  cachedToken = { token, expiresAtMs };
  return { ok: true, token, expiresAtMs };
}

export async function callPayex<T = unknown>(args: {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
}): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const config = getPayexConfig();
  if (!config) return { ok: false, message: "Payex config missing" };

  const auth = await getPayexBearerToken();
  if (!auth.ok) return auth;

  const response = await fetch(`${config.apiBaseUrl}${args.path}`, {
    method: args.method,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  });
  const raw = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  if (!response.ok) {
    const parts: string[] = [];
    if (typeof parsed?.status === "string" && parsed.status) parts.push(`status=${parsed.status}`);
    if (typeof parsed?.message === "string" && parsed.message) parts.push(parsed.message);
    if (typeof parsed?.error === "string" && parsed.error) parts.push(parsed.error);
    if (parsed?.result && typeof parsed.result === "object") {
      try {
        parts.push(JSON.stringify(parsed.result));
      } catch {}
    }
    if (!parts.length && raw) {
      parts.push(raw);
    }
    const message = parts.length ? parts.join(" | ") : `Payex error ${response.status}`;
    return { ok: false, message };
  }
  return { ok: true, data: parsed as T };
}

export function getPayexUrls(channel: "shop" | "delivery", returnUrl?: string | null) {
  const config = getPayexConfig();
  const fallback = channel === "shop" ? config?.defaultShopReturnUrl : config?.defaultDeliveryReturnUrl;
  return {
    callbackUrl: config?.callbackUrl ?? "",
    returnUrl: returnUrl || fallback || "",
  };
}

async function sha512Hex(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-512", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPayexSignature(input: { txnId?: string | null; signature?: string | null }) {
  const config = getPayexConfig();
  if (!config?.signatureSecret) return { ok: false as const, message: "Payex signature secret not configured" };
  const txnId = input.txnId ?? "";
  const signature = (input.signature ?? "").toLowerCase();
  if (!txnId || !signature) return { ok: false as const, message: "Missing txn_id or signature" };
  const expected = (await sha512Hex(`${config.signatureSecret}|${txnId}`)).toLowerCase();
  if (expected !== signature) return { ok: false as const, message: "Invalid Payex signature" };
  return { ok: true as const };
}
