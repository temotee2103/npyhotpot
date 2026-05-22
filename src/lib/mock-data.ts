import { assetPath } from "@/lib/site-config";
import type { FoodItem, Outlet, SoupPack } from "@/lib/types";

export const outlets: Outlet[] = [
  {
    id: "ou-1",
    name: "Nan Peng You Hotpot SS2",
    location: "Petaling Jaya",
    hours: "11:00 - 23:00",
  },
  {
    id: "ou-2",
    name: "Nan Peng You Hotpot Sri Petaling",
    location: "Kuala Lumpur",
    hours: "11:00 - 23:30",
  },
];

export const soupPacks: SoupPack[] = [
  {
    id: "sp-1",
    title: "XO Fish Maw Sesame Chicken Soup (XO花胶麻油鸡汤)",
    subtitle: "850g / pack (Serves 2-3)",
    price: 25.9,
    image: assetPath("/logo.png"),
  },
  {
    id: "sp-2",
    title: "Double Fish Maw Beauty Soup (双倍花胶美颜汤)",
    subtitle: "600g / pack (Premium Deep Sea Fish Maw)",
    price: 25.9,
    image: assetPath("/logo.png"),
  },
  {
    id: "sp-3",
    title: "Fish Maw Scallop Porridge (花胶干贝粥)",
    subtitle: "600g / pack (Heat & Eat)",
    price: 22.9,
    image: assetPath("/logo.png"),
  },
  {
    id: "sp-4",
    title: "XO Fish Maw Soup Bundle (Buy 5 Free 1)",
    subtitle: "6 Packs Total - Best Seller",
    price: 129.5,
    image: assetPath("/logo.png"),
  },
  {
    id: "sp-5",
    title: "MIX Value Bundle (Buy 5 Free 1)",
    subtitle: "Assorted Flavors Set",
    price: 126.5,
    image: assetPath("/logo.png"),
  },
  {
    id: "sp-6",
    title: "Double Fish Maw Bundle (Buy 5 Free 1)",
    subtitle: "6 Packs Total - Beauty Series",
    price: 129.5,
    image: assetPath("/logo.png"),
  },
];

export const foodMenu: FoodItem[] = [
  { id: "fm-1", name: "Signature Golden Soup Base", price: 28, category: "Soup Base" },
  { id: "fm-2", name: "Sichuan Mala Butter Base", price: 25, category: "Soup Base" },
  { id: "fm-3", name: "Australian Wagyu Beef Slices (M5)", price: 68, category: "Protein" },
  { id: "fm-4", name: "Premium Spanish Iberico Pork", price: 42, category: "Protein" },
  { id: "fm-5", name: "Handmade Prawn Paste", price: 28, category: "Seafood" },
  { id: "fm-6", name: "Hokkaido Scallops (3pcs)", price: 38, category: "Seafood" },
  { id: "fm-7", name: "Organic Vegetable Basket", price: 18, category: "Vegetable" },
  { id: "fm-8", name: "Deep Fried Beancurd Roll", price: 12, category: "Sides" },
  { id: "fm-9", name: "Signature Dipping Sauce", price: 5, category: "Sides" },
];
