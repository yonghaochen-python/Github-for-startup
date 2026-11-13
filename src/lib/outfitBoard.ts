"use client";

/**
 * "Build an outfit": lays an outfit's pieces out on one clean picture (4:5, warm off-white), the way a styled flat lay
 * reads: jackets and tops at the top, then dresses and bottoms, then shoes, with bags and accessories in a column on
 * the right. Made on the device from the pieces' own pictures: no AI, no cost.
 */

export type BoardPiece = { imageUrl: string; role: string };

const WIDTH = 1080;
const HEIGHT = 1350;
const BACKGROUND = "#f4f2ee";
const MARGIN = 54;

/** Which band a piece goes in. */
function band(role: string): "top" | "middle" | "feet" | "side" {
  if (role === "outer_layer" || role === "mid_layer" || role === "base_layer") return "top";
  if (role === "bottom" || role === "one_piece") return "middle";
  if (role === "shoes") return "feet";
  return "side";
}

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
  const loaded = (await Promise.all(pieces.map(async (p) => ({ role: p.role, img: await loadImage(p.imageUrl) })))).filter(
    (p): p is { role: string; img: ImageBitmap } => p.img !== null
  );
  if (loaded.length === 0) throw new Error("Add pieces with pictures first.");

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't make the picture.");
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const groups = { top: [] as ImageBitmap[], middle: [] as ImageBitmap[], feet: [] as ImageBitmap[], side: [] as ImageBitmap[] };
  for (const p of loaded) groups[band(p.role)].push(p.img);

  // The side column only when there are accessories; otherwise the main column gets the full width.
  const sideW = groups.side.length ? Math.round((WIDTH - MARGIN * 2) * 0.28) : 0;
  const gap = 24;
  const mainX = MARGIN;
  const mainW = WIDTH - MARGIN * 2 - (sideW ? sideW + gap : 0);
  const usable = HEIGHT - MARGIN * 2;

  // Each band wraps into rows of at most two pieces, so every piece gets a fair size; rows share the height by
  // weight (tops and bottoms more than shoes).
  const weights = { top: 1, middle: 1.1, feet: 0.6 } as const;
  const rows: { pieces: ImageBitmap[]; weight: number }[] = [];
  for (const b of ["top", "middle", "feet"] as const) {
    for (let i = 0; i < groups[b].length; i += 2) rows.push({ pieces: groups[b].slice(i, i + 2), weight: weights[b] });
  }
  const total = rows.reduce((t, r) => t + r.weight, 0) || 1;
  let y = MARGIN;
  for (const row of rows) {
    const h = (usable - gap * (rows.length - 1)) * (row.weight / total);
    const cellW = (mainW - gap * (row.pieces.length - 1)) / row.pieces.length;
    row.pieces.forEach((img, i) => drawFitted(ctx, img, mainX + i * (cellW + gap), y, cellW, h));
    y += h + gap;
  }

  if (sideW) {
    const x = WIDTH - MARGIN - sideW;
    const cellH = (usable - gap * (groups.side.length - 1)) / groups.side.length;
    groups.side.forEach((img, i) => drawFitted(ctx, img, x, MARGIN + i * (cellH + gap), sideW, Math.min(cellH, sideW * 1.2)));
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
