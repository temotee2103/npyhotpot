const KEY_V1 = "shop_cart_v1";
const KEY_V2 = "shop_cart_v2";

export type CartItemVariant = { kind: "variant"; id: string; qty: number };
export type CartItemBundle = { kind: "bundle"; id: string; bundleId: string; qty: number; selection: Record<string, number> };
export type CartItem = CartItemVariant | CartItemBundle;
export type CartState = { version: 2; items: CartItem[] };
export type LegacyCart = Record<string, number>;

function normalize(state: CartState): CartState {
  const items = state.items
    .map((it) => {
      if (it.kind === "variant") return { ...it, qty: Math.max(0, Math.floor(it.qty)) };
      const parsed = String(it.id ?? "").split(":");
      const bundleId = it.bundleId || (parsed[0] === "bundle" ? parsed[1] ?? "" : "");
      return {
        ...it,
        bundleId,
        qty: Math.max(0, Math.floor(it.qty)),
        selection: Object.fromEntries(
          Object.entries(it.selection ?? {})
            .map(([k, v]): [string, number] => [k, Math.max(0, Math.floor(v))])
            .filter(([, v]) => v > 0),
        ),
      };
    })
    .filter((it) => it.qty > 0);
  return { version: 2, items };
}

function readLegacy(): LegacyCart {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY_V1);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj as LegacyCart;
    return {};
  } catch {
    return {};
  }
}

export function readCartState(): CartState {
  if (typeof window === "undefined") return { version: 2, items: [] };
  try {
    const raw = localStorage.getItem(KEY_V2);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object" && obj.version === 2 && Array.isArray(obj.items)) {
        return normalize(obj as CartState);
      }
    }
  } catch {
  }
  const legacy = readLegacy();
  const items: CartItemVariant[] = Object.entries(legacy)
    .map(([id, qty]) => ({ kind: "variant" as const, id, qty: Math.max(0, Math.floor(qty ?? 0)) }))
    .filter((x) => x.qty > 0);
  return normalize({ version: 2, items });
}

export function writeCartState(state: CartState) {
  if (typeof window === "undefined") return;
  const normalized = normalize(state);
  localStorage.setItem(KEY_V2, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("shop:cart:change"));
}

export function clearCart() {
  writeCartState({ version: 2, items: [] });
}

export function getVariantQty(state: CartState, id: string) {
  const found = state.items.find((x) => x.kind === "variant" && x.id === id) as CartItemVariant | undefined;
  return found?.qty ?? 0;
}

export function setItem(id: string, qty: number) {
  const state = readCartState();
  const nextQty = Math.max(0, Math.floor(qty));
  const items = [...state.items];
  const idx = items.findIndex((x) => x.kind === "variant" && x.id === id);
  if (idx >= 0) {
    if (nextQty > 0) {
      items[idx] = { kind: "variant", id, qty: nextQty };
    } else {
      items.splice(idx, 1);
    }
  } else if (nextQty > 0) {
    items.push({ kind: "variant", id, qty: nextQty });
  }
  writeCartState({ version: 2, items });
}

export function addItem(id: string, delta = 1) {
  const state = readCartState();
  const current = getVariantQty(state, id);
  setItem(id, current + delta);
}

export function addBundleToCart(args: { bundleId: string; qty: number; selection: Record<string, number> }) {
  const state = readCartState();
  const qty = Math.max(1, Math.floor(args.qty));
  const selection = Object.fromEntries(Object.entries(args.selection ?? {}).filter(([, v]) => (v ?? 0) > 0));
  const id = `bundle:${args.bundleId}:${crypto.randomUUID()}`;
  writeCartState({ version: 2, items: [...state.items, { kind: "bundle", id, bundleId: args.bundleId, qty, selection }] });
}

export function removeCartItem(id: string) {
  const state = readCartState();
  writeCartState({ version: 2, items: state.items.filter((x) => x.id !== id) });
}

export function countItems(state?: CartState) {
  const s = state ?? readCartState();
  return s.items.reduce((sum, it) => {
    if (it.kind === "variant") return sum + it.qty;
    const packs = Object.values(it.selection ?? {}).reduce((a, n) => a + (Number.isFinite(n) ? n : 0), 0);
    return sum + (packs > 0 ? packs : it.qty);
  }, 0);
}
