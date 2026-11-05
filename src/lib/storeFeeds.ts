/**
 * Store Preview (admin only): how brand shelves could look in Virm. None of these brands has given permission or an
 * official product feed, so there is no real product data here: each shelf is clearly labelled placeholder cards,
 * and nothing is read from the brands' websites. When a brand agrees and sends its own feed, its shelf can show
 * real pieces. Virm has no partnership with any of them.
 */

export type PlaceholderKind = "Top" | "Bottom" | "Outerwear" | "Dress" | "Shoes" | "Accessory";

export type StorePreview = { id: string; name: string; permission: false; slots: PlaceholderKind[] };

const SLOTS: PlaceholderKind[] = ["Top", "Bottom", "Outerwear", "Dress", "Shoes", "Accessory"];

export const STORE_PREVIEWS: StorePreview[] = [
  { id: "allbirds", name: "Allbirds", permission: false, slots: SLOTS },
  { id: "alo", name: "Alo Yoga", permission: false, slots: SLOTS },
  { id: "taylor-stitch", name: "Taylor Stitch", permission: false, slots: SLOTS },
  { id: "tentree", name: "Tentree", permission: false, slots: SLOTS },
  { id: "cuyana", name: "Cuyana", permission: false, slots: SLOTS },
];
