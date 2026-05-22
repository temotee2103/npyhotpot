const KEY = "delivery_cart_v1";

export type DeliveryCartSelectedOption = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
};

export type DeliveryCartItem = {
  key: string;
  itemId: string;
  title: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  selectedOptions: DeliveryCartSelectedOption[];
};

export type DeliveryCartState = {
  items: DeliveryCartItem[];
};

type DeliveryCartInput = Omit<DeliveryCartItem, "quantity" | "key">;

function toMoney(value: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(2));
}

function normalizeSelectedOptions(selectedOptions: DeliveryCartSelectedOption[]): DeliveryCartSelectedOption[] {
  return [...selectedOptions]
    .map((option) => ({
      groupId: option.groupId,
      groupName: option.groupName.trim(),
      optionId: option.optionId,
      optionName: option.optionName.trim(),
      priceDelta: toMoney(option.priceDelta),
    }))
    .filter((option) => option.groupId && option.optionId && option.optionName)
    .sort((a, b) => {
      const groupCompare = a.groupName.localeCompare(b.groupName);
      if (groupCompare !== 0) return groupCompare;
      return a.optionName.localeCompare(b.optionName);
    });
}

export function buildDeliveryCartItemKey(itemId: string, selectedOptions: DeliveryCartSelectedOption[] = []) {
  const optionKey = normalizeSelectedOptions(selectedOptions)
    .map((option) => `${option.groupId}:${option.optionId}`)
    .join("|");
  return optionKey ? `${itemId}::${optionKey}` : itemId;
}

function normalizeLine(line: Partial<DeliveryCartItem>): DeliveryCartItem | null {
  const itemId = String(line.itemId ?? "").trim();
  if (!itemId) return null;
  const quantity = Math.max(0, Math.floor(Number(line.quantity) || 0));
  if (quantity <= 0) return null;
  const selectedOptions = normalizeSelectedOptions(Array.isArray(line.selectedOptions) ? line.selectedOptions : []);
  return {
    key: String(line.key || buildDeliveryCartItemKey(itemId, selectedOptions)),
    itemId,
    title: String(line.title ?? "").trim(),
    imageUrl: typeof line.imageUrl === "string" && line.imageUrl.trim() ? line.imageUrl.trim() : null,
    unitPrice: Math.max(0, toMoney(Number(line.unitPrice ?? 0))),
    quantity,
    selectedOptions,
  };
}

function normalize(state: unknown): DeliveryCartState {
  if (state && typeof state === "object" && Array.isArray((state as { items?: unknown[] }).items)) {
    return {
      items: ((state as { items: unknown[] }).items as Array<Partial<DeliveryCartItem>>).map(normalizeLine).filter(Boolean) as DeliveryCartItem[],
    };
  }
  if (state && typeof state === "object") {
    const legacyEntries = Object.entries(state as Record<string, unknown>)
      .map(([itemId, quantity]) =>
        normalizeLine({
          key: itemId,
          itemId,
          quantity: Math.max(0, Math.floor(Number(quantity) || 0)),
          title: "",
          imageUrl: null,
          unitPrice: 0,
          selectedOptions: [],
        }),
      )
      .filter(Boolean) as DeliveryCartItem[];
    return { items: legacyEntries };
  }
  return { items: [] };
}

export function formatDeliveryCartOptionSummary(selectedOptions: DeliveryCartSelectedOption[] = []) {
  return normalizeSelectedOptions(selectedOptions)
    .map((option) => option.optionName)
    .join(" / ");
}

export function buildDeliveryCartItemTitle(item: Pick<DeliveryCartItem, "title" | "selectedOptions">) {
  const summary = formatDeliveryCartOptionSummary(item.selectedOptions);
  return summary ? `${item.title} (${summary})` : item.title;
}

export function readDeliveryCart(): DeliveryCartState {
  if (typeof window === "undefined") return { items: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { items: [] };
    return normalize(JSON.parse(raw));
  } catch {
    return { items: [] };
  }
}

export function writeDeliveryCart(state: DeliveryCartState) {
  if (typeof window === "undefined") return;
  const normalized = normalize(state);
  localStorage.setItem(KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("delivery:cart:change"));
}

export function addDeliveryCartItem(input: DeliveryCartInput, delta = 1) {
  const state = readDeliveryCart();
  const selectedOptions = normalizeSelectedOptions(input.selectedOptions ?? []);
  const key = buildDeliveryCartItemKey(input.itemId, selectedOptions);
  const nextQty = Math.max(0, Math.floor(Number(delta) || 0));
  if (nextQty <= 0) return;
  const nextItems = [...state.items];
  const existingIndex = nextItems.findIndex((item) => item.key === key);
  if (existingIndex >= 0) {
    nextItems[existingIndex] = {
      ...nextItems[existingIndex],
      title: input.title.trim(),
      imageUrl: input.imageUrl ?? null,
      unitPrice: Math.max(0, toMoney(input.unitPrice)),
      selectedOptions,
      quantity: nextItems[existingIndex].quantity + nextQty,
    };
  } else {
    nextItems.push({
      key,
      itemId: input.itemId,
      title: input.title.trim(),
      imageUrl: input.imageUrl ?? null,
      unitPrice: Math.max(0, toMoney(input.unitPrice)),
      quantity: nextQty,
      selectedOptions,
    });
  }
  writeDeliveryCart({ items: nextItems });
}

export function setDeliveryCartItemQuantity(key: string, qty: number) {
  const state = readDeliveryCart();
  const nextQty = Math.max(0, Math.floor(qty));
  const nextItems = state.items
    .map((item) => (item.key === key ? { ...item, quantity: nextQty } : item))
    .filter((item) => item.quantity > 0);
  writeDeliveryCart({ items: nextItems });
}

export function removeDeliveryCartItem(key: string) {
  const state = readDeliveryCart();
  writeDeliveryCart({ items: state.items.filter((item) => item.key !== key) });
}

export function clearDeliveryCart() {
  writeDeliveryCart({ items: [] });
}

export function countDeliveryCartItems(state?: DeliveryCartState) {
  return (state ?? readDeliveryCart()).items.reduce((sum, item) => sum + item.quantity, 0);
}
