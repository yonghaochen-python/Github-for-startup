"use client";

import { cutOut } from "@/lib/cutout";

/**
 * "Build an outfit": an organized outfit board, like the ones shared on fashion sites. The clothes stack down the left
 * the way they're worn (the top peeking out under the jacket's neckline, the jacket's hem over the bottoms' waist,
 * shoes underneath); bag, shoes and small accessories sit in a tidy column on the right. Every piece gets a box sized
 * for its kind, so they read at believable sizes and each one stays clearly visible. Backgrounds are removed first.
 * Made on the device from the pieces' own pictures: no AI, no cost.
 */

export type BoardPiece = { imageUrl: string; role: string; name?: string };

const WIDTH = 1080;
const HEIGHT = 1350;
const BACKGROUND = "#ecebe8";

/** A box on the picture, as fractions of the width and height: left, top, right, bottom. */
type Box = [number, number, number, number];

/** What kind of accessory, from its name (hats, sunglasses, bags, jewelry); anything else goes in a free spot. */
function accessoryKind(name: string): "hat" | "glasses" | "bag" | "jewelry" | "other" {
  const n = name.toLowerCase();
  if (/\b(hat|cap|beanie|beret|bucket|visor|headband)\b/.test(n)) return "hat";
  if (/glasses|sunnies|shades/.test(n)) return "glasses";
  if (/\b(bag|tote|purse|clutch|backpack|handbag|crossbody|satchel|pouch)\b/.test(n)) return "bag";
  if (/\b(watch|bracelet|ring|rings|necklace|earring|earrings|bangle|jewel|jewelry|chain|pendant|anklet)\b/.test(n)) return "jewelry";
  return "other";
}

/** Where each accessory kind goes, and the free spots used for the rest (in order). */
/** The right-hand column: small things at the top, the bag in the middle (shoes go under it). */
const ACCESSORY_BOX: Record<"hat" | "glasses" | "bag" | "jewelry", Box> = {
  hat: [0.66, 0.04, 0.94, 0.17],
  glasses: [0.68, 0.06, 0.92, 0.15],
  jewelry: [0.7, 0.2, 0.9, 0.33],
  bag: [0.63, 0.37, 0.95, 0.6],
};
const FREE_BOXES: Box[] = [ACCESSORY_BOX.bag, ACCESSORY_BOX.jewelry, ACCESSORY_BOX.hat, [0.7, 0.88, 0.92, 0.98]];

async function loadImage(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

/** Draws each picture fitted inside its box, centered, keeping its shape. */
function drawFitted(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** The outfit picture (WebP) and its size. Pieces without a picture are left out of it. */
export async function outfitBoard(pieces: BoardPiece[]): Promise<{ blob: Blob; width: number; height: number }> {
  const loaded = (
    await Promise.all(pieces.map(async (p) => ({ role: p.role, name: p.name ?? "", img: await loadImage(await withoutBackground(p.imageUrl)) })))
  ).filter((p): p is { role: string; name: string; img: ImageBitmap } => p.img !== null);
  if (loaded.length === 0) throw new Error("Add pieces with pictures first.");

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't make the picture.");
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const of = (roles: string[]) => loaded.filter((p) => roles.includes(p.role));
  const jacket = of(["outer_layer"])[0];
  const tops = of(["mid_layer", "base_layer"]);
  const dress = of(["one_piece"])[0];
  const bottom = of(["bottom"])[0];
  const shoes = of(["shoes"])[0];
  const accessories = loaded.filter((p) => !["outer_layer", "mid_layer", "base_layer", "one_piece", "bottom", "shoes"].includes(p.role));

  // Placed in drawing order, so later pieces lie on top. The left column, worn order: the inner top (peeking out at the
  // neckline), the bottoms or dress, then the jacket over them, shoes underneath.
  const placed: { img: ImageBitmap; box: Box }[] = [];
  const outerPiece = jacket ?? (tops.length > 1 ? tops[tops.length - 1] : undefined);
  const innerTops = jacket ? tops : tops.slice(0, outerPiece ? -1 : undefined);
  const inner = innerTops[0];
  const JACKET: Box = [0.04, 0.09, 0.54, 0.44];
  if (dress) placed.push({ img: dress.img, box: outerPiece ? [0.12, 0.14, 0.54, 0.74] : [0.1, 0.06, 0.56, 0.72] });
  // Under a jacket, the top sits up and to the right so it shows beside the jacket (not hidden behind it).
  if (inner) placed.push({ img: inner.img, box: outerPiece ? [0.33, 0.04, 0.66, 0.34] : JACKET });
  // Long trousers (taller than wide) get the height down to the bottom, and the shoes move to the right column.
  const longBottom = Boolean(!dress && bottom && bottom.img.height / bottom.img.width > 1.3);
  if (!dress && bottom) {
    const upperBody = Boolean(inner || outerPiece);
    const box: Box = longBottom ? (upperBody ? [0.12, 0.32, 0.54, 0.96] : [0.12, 0.06, 0.54, 0.9]) : upperBody ? [0.13, 0.34, 0.53, 0.68] : [0.13, 0.08, 0.53, 0.62];
    placed.push({ img: bottom.img, box });
  }
  if (outerPiece) placed.push({ img: outerPiece.img, box: JACKET });
  // Any other top goes in the right column's free spot.
  const extraTops = innerTops.slice(1);
  // Shoes: under the clothes on the left, or under the bag on the right when long trousers take the left.
  if (shoes) placed.push({ img: shoes.img, box: longBottom ? [0.62, 0.66, 0.96, 0.88] : [0.08, 0.7, 0.5, 0.95] });

  // The right column: accessories by kind (from their names); anything else in the next free spot.
  const used = new Set<Box>();
  for (const a of [...accessories, ...extraTops]) {
    const kind = accessoryKind(a.name);
    let box: Box | undefined = kind !== "other" && !used.has(ACCESSORY_BOX[kind]) ? ACCESSORY_BOX[kind] : undefined;
    box ??= FREE_BOXES.find((b) => !used.has(b));
    if (!box) continue;
    used.add(box);
    placed.push({ img: a.img, box });
  }

  // A soft shadow lifts each piece off the white, so overlaps read clearly.
  ctx.shadowColor = "rgba(18, 24, 33, 0.14)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  for (const { img, box } of placed) {
    const [l, t, r, b] = box;
    drawFitted(ctx, img, l * WIDTH, t * HEIGHT, (r - l) * WIDTH, (b - t) * HEIGHT);
  }
  for (const p of loaded) p.img.close();

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the picture."))), "image/webp", 0.9));
  return { blob, width: WIDTH, height: HEIGHT };
}

/** A store piece's picture, shrunk for the post (square-ish, WebP, at most 640 px). */
export async function shrinkPicture(url: string, side = 640): Promise<Blob | null> {
  const img = await loadImage(url);
  if (!img) return null;
  const scale = Math.min(1, side / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", 0.86));
}

const isCutout = (url: string) => url.startsWith("/uploads/cut-") || url.startsWith("data:image/png;cut");

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(blob);
  });

/**
 * The piece's picture with its background removed, on this device (free). Keeps the original when no clear piece is
 * found, or when it's already a cut-out.
 */
export async function withoutBackground(url: string): Promise<string> {
  if (isCutout(url)) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const cut = await cutOut(await res.blob());
    return cut ? toDataUrl(cut) : url;
  } catch {
    return url;
  }
}
