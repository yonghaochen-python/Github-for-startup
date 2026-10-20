import { SAMPLE_CLOSET } from "@/lib/sampleCloset";

/**
 * "Try it free": ready-made outfits from the starter closet, shown on the example model (an Unsplash photo).
 * Every picture was made once in advance and is a plain file in public/guest-looks/, so guests use no AI, no
 * account and no storage, and cost nothing however many visit. Nothing a guest does is saved.
 */

export const GUEST_MODEL_PHOTO = "/whats-new/full-body.jpg";

type GuestLook = { slug: string; name: string; pieces: string[] };

/** Pieces are the starter-closet image names in /sample/ (without .jpg). */
const LOOKS: GuestLook[] = [
  { slug: "autumn-layers", name: "Autumn layers", pieces: ["camel-coat", "turtleneck", "plaid-skirt", "knee-boots"] },
  { slug: "weekend-classic", name: "Weekend classic", pieces: ["white-tshirt", "light-jeans", "white-sneakers"] },
  { slug: "garden-party", name: "Garden party", pieces: ["floral-sundress", "strappy-sandals", "straw-hat"] },
  { slug: "easy-sundress", name: "Easy sundress", pieces: ["floral-sundress", "white-sneakers"] },
  { slug: "beach-day", name: "Beach day", pieces: ["linen-shirt", "denim-shorts", "leather-sandals", "straw-hat"] },
  { slug: "summer-errands", name: "Summer errands", pieces: ["white-tshirt", "denim-shorts", "white-sneakers"] },
  { slug: "cafe-afternoon", name: "Café afternoon", pieces: ["eyelet-blouse", "light-jeans", "strappy-sandals"] },
  { slug: "picnic", name: "Picnic", pieces: ["eyelet-blouse", "denim-shorts", "strappy-sandals", "straw-hat"] },
  { slug: "linen-and-chinos", name: "Linen & chinos", pieces: ["linen-shirt", "chino-shorts", "white-sneakers"] },
  { slug: "cozy-knit", name: "Cozy knit", pieces: ["cable-sweater", "light-jeans", "chelsea-boots"] },
  { slug: "snow-day", name: "Snow day", pieces: ["white-tshirt", "cable-sweater", "puffer-jacket", "wool-trousers", "chelsea-boots"] },
  { slug: "office-winter", name: "Office winter", pieces: ["turtleneck", "wool-trousers", "chelsea-boots"] },
  { slug: "wrap-coat-plaid", name: "Wrap coat & plaid", pieces: ["wrap-coat", "turtleneck", "plaid-skirt", "knee-boots"] },
  { slug: "city-coat", name: "City coat", pieces: ["camel-coat", "white-tshirt", "light-jeans", "white-sneakers"] },
  { slug: "puffer-and-jeans", name: "Puffer & jeans", pieces: ["puffer-jacket", "turtleneck", "light-jeans", "knee-boots"] },
  { slug: "plaid-and-knit", name: "Plaid & knit", pieces: ["cable-sweater", "plaid-skirt", "knee-boots"] },
  { slug: "smart-and-simple", name: "Smart & simple", pieces: ["linen-shirt", "wool-trousers", "chelsea-boots"] },
  { slug: "camel-and-cream", name: "Camel & cream", pieces: ["wrap-coat", "cable-sweater", "wool-trousers", "chelsea-boots"] },
  { slug: "linen-and-denim", name: "Linen & denim", pieces: ["linen-shirt", "light-jeans", "white-sneakers"] },
  { slug: "black-and-denim", name: "Black & denim", pieces: ["turtleneck", "light-jeans", "white-sneakers"] },
];

const BY_IMAGE = new Map(SAMPLE_CLOSET.map((item) => [item.imageUrl, item]));

export type GuestPiece = { imageUrl: string; description: string; layeringRole: string };
export type GuestLookWithPieces = GuestLook & { picture: string; items: GuestPiece[] };

export const GUEST_LOOKS: GuestLookWithPieces[] = LOOKS.map((look) => ({
  ...look,
  picture: `/guest-looks/${look.slug}.jpg`,
  items: look.pieces.map((name) => {
    const item = BY_IMAGE.get(`/sample/${name}.jpg`);
    if (!item) throw new Error(`Unknown starter piece: ${name}`);
    return { imageUrl: item.imageUrl, description: item.description, layeringRole: item.layeringRole };
  }),
}));
