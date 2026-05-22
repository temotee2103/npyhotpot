export {};

declare global {
  interface WindowEventMap {
    "shop:cart:change": Event;
    "delivery:cart:change": Event;
  }
}
