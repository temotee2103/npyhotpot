type LalamoveRequestArgs = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
};

function getConfig() {
  const baseUrl = Deno.env.get("LALAMOVE_API_BASE_URL") ?? "https://rest.sandbox.lalamove.com";
  const market = Deno.env.get("LALAMOVE_MARKET") ?? "MY";
  const apiKey = Deno.env.get("LALAMOVE_API_KEY") ?? "";
  const apiSecret = Deno.env.get("LALAMOVE_API_SECRET") ?? "";
  const mock = Deno.env.get("LALAMOVE_MOCK_MODE") === "1" || !apiKey || !apiSecret;
  return { baseUrl, market, apiKey, apiSecret, mock };
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signPayload(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(signature);
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function buildSigningPayload(method: string, path: string, timestamp: string, bodyText: string) {
  return `${timestamp}\r\n${method.toUpperCase()}\r\n${path}\r\n\r\n${bodyText}`;
}

export async function callLalamove<T = unknown>({ method, path, body }: LalamoveRequestArgs): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const config = getConfig();
  const normalizedPath = normalizePath(path);
  const bodyText = body ? JSON.stringify(body) : "";
  if (config.mock) {
    return { ok: false, message: "Lalamove credentials not configured" };
  }

  const timestamp = Date.now().toString();
  const signingPayload = buildSigningPayload(method, normalizedPath, timestamp, bodyText);
  const signature = await signPayload(config.apiSecret, signingPayload);
  const authHeader = `hmac ${config.apiKey}:${timestamp}:${signature}`;
  const url = `${config.baseUrl}${normalizedPath}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      Market: config.market,
      "Request-ID": crypto.randomUUID(),
    },
    body: method === "POST" ? bodyText : undefined,
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  if (!response.ok) {
    const details = Array.isArray(parsed?.errors)
      ? parsed.errors
          .map((item) => {
            const row = item as { id?: string; message?: string; detail?: string };
            return [row.id, row.message, row.detail].filter(Boolean).join(": ");
          })
          .filter(Boolean)
          .join(" | ")
      : "";
    const message =
      typeof parsed?.message === "string"
        ? parsed.message
        : details || `Lalamove error ${response.status}`;
    return { ok: false, message };
  }
  return { ok: true, data: parsed as T };
}

export function getLalamoveMockMode() {
  return getConfig().mock;
}
