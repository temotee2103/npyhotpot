export const DEFAULT_ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type";

function parseAllowedOrigins(raw: string | null | undefined) {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function mergeAllowedHeaders(extraHeaders: string[] | undefined) {
  const defaults = DEFAULT_ALLOWED_HEADERS.split(",").map((x) => x.trim()).filter(Boolean);
  const extras = (extraHeaders ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set([...defaults, ...extras])).join(", ");
}

export function buildCorsHeaders(request: Request, extraAllowedHeaders?: string[]) {
  const origin = request.headers.get("origin") ?? "";
  const allowlist = parseAllowedOrigins(Deno.env.get("EDGE_ALLOWED_ORIGINS"));
  const allowOrigin = origin && allowlist.includes(origin) ? origin : "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": mergeAllowedHeaders(extraAllowedHeaders),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function isCorsAllowed(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  if (!origin) return true;

  const allowlist = parseAllowedOrigins(Deno.env.get("EDGE_ALLOWED_ORIGINS"));
  return allowlist.includes(origin);
}
