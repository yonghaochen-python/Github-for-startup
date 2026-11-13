"use client";

import { cutOut } from "@/lib/cutout";

/**
 * "Build an outfit": a styled collage on white, like a fashion moodboard. Pieces are big and overlap: the jacket at the
 * top left with the top lying across it, the bottoms running down the middle, shoes at the bottom right, and
 * accessories tucked around the edges (hat top right, sunglasses top left, bag over the left side, jewelry on the
 * right). Backgrounds are removed first. Made on the device from the pieces' own pictures: no AI, no cost.
 */

export type BoardPiece = { imageUrl: string; role: string; name?: string };

const WIDTH = 1080;
const HEIGHT = 1350;
const BACKGROUND = "#ffffff";

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
const ACCESSORY_BOX: Record<"hat" | "glasses" | "bag" | "jewelry", Box> = {
  hat: [0.66, 0.02, 0.99, 0.2],
  glasses: [0.12, 0.05, 0.38, 0.16],
  bag: [0.03, 0.46, 0.44, 0.78],
  jewelry: [0.76, 0.46, 0.99, 0.6],
};
const FREE_BOXES: Box[] = [ACCESSORY_BOX.bag, ACCESSORY_BOX.hat, ACCESSORY_BOX.jewelry, ACCESSORY_BOX.glasses];

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

  // Placed in drawing order, so later pieces lie on top: bottoms, jacket, tops, shoes, then accessories.
  const placed: { img: ImageBitmap; box: Box }[] = [];
  const hasTopHalf = Boolean(jacket || tops.length);
  if (dress) placed.push({ img: dress.img, box: hasTopHalf ? [0.26, 0.24, 0.74, 0.96] : [0.22, 0.06, 0.78, 0.9] });
  else if (bottom) placed.push({ img: bottom.img, box: hasTopHalf ? [0.3, 0.38, 0.74, 0.98] : [0.25, 0.08, 0.75, 0.92] });
  const below = Boolean(dress || bottom);
  // Upper body: the jacket (or the first top) big at the top left, the next top across it on the right.
  const upper = [jacket, ...tops].filter((p): p is (typeof loaded)[number] => Boolean(p)).slice(0, 3);
  const upperBoxes: Box[] = below
    ? [
        [0.1, 0.06, 0.66, 0.46],
        [0.5, 0.18, 0.86, 0.52],
        [0.44, 0.04, 0.72, 0.26],
      ]
    : [
        [0.08, 0.08, 0.66, 0.6],
        [0.46, 0.26, 0.9, 0.7],
        [0.44, 0.04, 0.74, 0.3],
      ];
  upper.forEach((p, i) => placed.push({ img: p.img, box: upperBoxes[i] }));
  if (shoes) placed.push({ img: shoes.img, box: [0.56, 0.62, 0.99, 0.9] });
  // Accessories: each kind in its own spot; anything else (or a second of a kind) in the next free spot.
  const used = new Set<Box>();
  for (const a of accessories) {
    const kind = accessoryKind(a.name);
    let box: Box | undefined = kind !== "other" && !used.has(ACCESSORY_BOX[kind]) ? ACCESSORY_BOX[kind] : undefined;
    box ??= FREE_BOXES.find((b) => !used.has(b));
    if (!box) continue;
    used.add(box);
    placed.push({ img: a.img, box });
  }

  // A soft shadow lifts each piece off the white, so overlaps read clearly.
  ctx.shadowColor = "rgba(18, 24, 33, 0.16)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
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
