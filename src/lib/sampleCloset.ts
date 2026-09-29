import type { ClothingAttributes } from "@/lib/classify";

/**
 * Seeded into every new account so the closet isn't empty on first login.
 * Not run through AI classification — these are fixed, hand-written entries.
 */
export const SAMPLE_CLOSET: (ClothingAttributes & { imageUrl: string })[] = [
  {
    imageUrl: "/sample/white-shirt.svg",
    category: "top",
    color: "white",
    pattern: "solid",
    material: "cotton",
    formality: "smart-casual",
    season: "all-season",
    description: "White fitted shirt",
  },
  {
    imageUrl: "/sample/blue-jeans.svg",
    category: "bottom",
    color: "blue",
    pattern: "solid",
    material: "denim",
    formality: "casual",
    season: "all-season",
    description: "Straight-leg blue jeans",
  },
  {
    imageUrl: "/sample/gray-cardigan.svg",
    category: "outerwear",
    color: "gray",
    pattern: "solid",
    material: "wool blend",
    formality: "smart-casual",
    season: "fall",
    description: "Gray cardigan",
  },
  {
    imageUrl: "/sample/white-sneakers.svg",
    category: "shoes",
    color: "white",
    pattern: "solid",
    material: "canvas",
    formality: "casual",
    season: "all-season",
    description: "White sneakers",
  },
  {
    imageUrl: "/sample/black-dress.svg",
    category: "dress",
    color: "black",
    pattern: "solid",
    material: "jersey",
    formality: "formal",
    season: "all-season",
    description: "Black wrap dress",
  },
  {
    imageUrl: "/sample/brown-belt.svg",
    category: "accessory",
    color: "brown",
    pattern: "solid",
    material: "leather",
    formality: "smart-casual",
    season: "all-season",
    description: "Brown leather belt",
  },
];
