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
/** Where a picture lands when fitted inside a box (kept in shape, centered), as fractions of the board. */
function fitted(img: { width: number; height: number }, [l, t, r, b]: Box): { x: number; y: number; w: number; h: number } {
  const bw = (r - l) * WIDTH;
  const bh = (b - t) * HEIGHT;
  const scale = Math.min(bw / img.width, bh / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  return { x: (l * WIDTH + (bw - w) / 2) / WIDTH, y: (t * HEIGHT + (bh - h) / 2) / HEIGHT, w: w / WIDTH, h: h / HEIGHT };
}

/**
 * One layer on the board, as fractions of the board (x, y = top left of its box; w, h = its size). The list's order is
 * the stacking order: later layers lie on top. People can move, resize, rotate, crop and restack these; nothing is
 * drawn until they're done.
 * - A picture (`src`): a piece (background removed), the post's own photo, or any picture added from the device.
 *   `crop` is the part of the picture shown (left, top, right, bottom as fractions of the picture).
 * - Text (`text`): drawn in one of the TEXT_STYLES, its size following the box's height.
 */
export type BoardLayer = {
  key: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Turned this many degrees clockwise around its center. */
  rot?: number;
  crop?: [number, number, number, number];
  /** No soft shadow (the post's own photo, laid flat under everything). */
  flat?: boolean;
  text?: string;
  color?: string;
  font?: TextStyle;
};
export type TextStyle = "serif" | "sans" | "bold";
export const TEXT_STYLES: { value: TextStyle; label: string }[] = [
  { value: "serif", label: "Classic" },
  { value: "sans", label: "Clean" },
  { value: "bold", label: "Bold" },
];
export const TEXT_COLORS = ["#121821", "#ffffff", "#a1312a", "#b8860b", "#3f5d4a", "#2f4a6d"];
/** The board's own colors (the first is the original stone). */
export const BOARD_COLORS = [BACKGROUND, "#ffffff", "#f3ece2", "#ead9d3", "#dbe3d6", "#d6dee8", "#121821"];

/** A board: its size in pixels (the post picture's size), its color, and its layers. */
export type Board = { width: number; height: number; background: string; layers: BoardLayer[] };
export const BOARD_RATIO = WIDTH / HEIGHT;
export const BOARD_BACKGROUND = BACKGROUND;
export const newBoard = (layers: BoardLayer[]): Board => ({ width: WIDTH, height: HEIGHT, background: BACKGROUND, layers });

/** The font for a text style, in pixels (the page's own fonts, so it looks the same on the board and in the post). */
export function textFont(style: TextStyle | undefined, px: number): string {
  const css = typeof document === "undefined" ? null : getComputedStyle(document.documentElement);
  const serif = css?.getPropertyValue("--font-instrument-serif").trim() || "Georgia";
  const sans = css?.getPropertyValue("--font-dm-sans").trim() || "Arial";
  if (style === "serif") return `400 ${px}px ${serif}, Georgia, serif`;
  if (style === "bold") return `700 ${px}px ${sans}, Arial, sans-serif`;
  return `500 ${px}px ${sans}, Arial, sans-serif`;
}
/** Text size in pixels for a box this tall (fraction of the board) holding this many lines. */
export const textPx = (h: number, lines: number, boardHeight: number) => (h * boardHeight) / Math.max(1, lines) / 1.2;
const linesOf = (layer: BoardLayer) => (layer.font === "bold" ? (layer.text ?? "").toUpperCase() : (layer.text ?? "")).split("\n");

/** The box a text layer needs at a given font size (in pixels), as fractions of the board. */
export function measureText(text: string, style: TextStyle, px: number, board: { width: number; height: number }): { w: number; h: number } {
  const ctx = document.createElement("canvas").getContext("2d");
  const lines = (style === "bold" ? text.toUpperCase() : text).split("\n");
  let widest = px;
  if (ctx) {
    ctx.font = textFont(style, px);
    if (style === "bold") ctx.letterSpacing = `${px * 0.04}px`;
    for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
  }
  return { w: (widest + px * 0.4) / board.width, h: (lines.length * px * 1.2) / board.height };
}

/** The automatic arrangement: every piece placed (backgrounds removed). Pieces without a picture are left out. */
export async function layoutBoard(pieces: (BoardPiece & { key: string })[]): Promise<BoardLayer[]> {
  const loaded = (
    await Promise.all(
      pieces.map(async (p) => {
        const src = await withoutBackground(p.imageUrl);
        return { role: p.role, name: p.name ?? "", key: p.key, src, img: await loadImage(src) };
      })
    )
  ).filter((p): p is { role: string; name: string; key: string; src: string; img: ImageBitmap } => p.img !== null);
  if (loaded.length === 0) throw new Error("Add pieces with pictures first.");

  const of = (roles: string[]) => loaded.filter((p) => roles.includes(p.role));
  const jacket = of(["outer_layer"])[0];
  const tops = of(["mid_layer", "base_layer"]);
  const dress = of(["one_piece"])[0];
  const bottom = of(["bottom"])[0];
  const shoes = of(["shoes"])[0];
  const accessories = loaded.filter((p) => !["outer_layer", "mid_layer", "base_layer", "one_piece", "bottom", "shoes"].includes(p.role));

  // Placed in drawing order, so later pieces lie on top. The left column, worn order: the inner top (peeking out at the
  // neckline), the bottoms or dress, then the jacket over them, shoes underneath.
  type Loaded = (typeof loaded)[number];
  const placed: { piece: Loaded; box: Box }[] = [];
  const outerPiece = jacket ?? (tops.length > 1 ? tops[tops.length - 1] : undefined);
  const innerTops = jacket ? tops : tops.slice(0, outerPiece ? -1 : undefined);
  const inner = innerTops[0];
  const JACKET: Box = [0.04, 0.09, 0.54, 0.44];
  if (dress) placed.push({ piece: dress, box: outerPiece ? [0.12, 0.14, 0.54, 0.74] : [0.1, 0.06, 0.56, 0.72] });
  // Under a jacket, the top sits up and to the right so it shows beside the jacket (not hidden behind it).
  if (inner) placed.push({ piece: inner, box: outerPiece ? [0.33, 0.04, 0.66, 0.34] : JACKET });
  // Long trousers (taller than wide) get the height down to the bottom, and the shoes move to the right column.
  const longBottom = Boolean(!dress && bottom && bottom.img.height / bottom.img.width > 1.3);
  if (!dress && bottom) {
    const upperBody = Boolean(inner || outerPiece);
    const box: Box = longBottom ? (upperBody ? [0.12, 0.32, 0.54, 0.96] : [0.12, 0.06, 0.54, 0.9]) : upperBody ? [0.13, 0.34, 0.53, 0.68] : [0.13, 0.08, 0.53, 0.62];
    placed.push({ piece: bottom, box });
  }
  if (outerPiece) placed.push({ piece: outerPiece, box: JACKET });
  // Any other top goes in the right column's free spot.
  const extraTops = innerTops.slice(1);
  // Shoes: under the clothes on the left, or under the bag on the right when long trousers take the left.
  if (shoes) placed.push({ piece: shoes, box: longBottom ? [0.62, 0.66, 0.96, 0.88] : [0.08, 0.7, 0.5, 0.95] });

  // The right column: accessories by kind (from their names); anything else in the next free spot.
  const used = new Set<Box>();
  for (const a of [...accessories, ...extraTops]) {
    const kind = accessoryKind(a.name);
    let box: Box | undefined = kind !== "other" && !used.has(ACCESSORY_BOX[kind]) ? ACCESSORY_BOX[kind] : undefined;
    box ??= FREE_BOXES.find((b) => !used.has(b));
    if (!box) continue;
    used.add(box);
    placed.push({ piece: a, box });
  }

  const layers = placed.map(({ piece, box }) => ({ src: piece.src, key: piece.key, ...fitted(piece.img, box) }));
  for (const p of loaded) p.img.close();
  return layers;
}

/** Draws the board (in stacking order) into the post's picture (WebP). */
export async function renderBoard(board: Board): Promise<{ blob: Blob; width: number; height: number }> {
  const { width: W, height: H } = board;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't make the picture.");
  ctx.fillStyle = board.background;
  ctx.fillRect(0, 0, W, H);
  // The page's fonts must be ready before text is drawn.
  await document.fonts?.ready.catch(() => undefined);
  for (const layer of board.layers) {
    const w = layer.w * W;
    const h = layer.h * H;
    ctx.save();
    ctx.translate(layer.x * W + w / 2, layer.y * H + h / 2);
    ctx.rotate(((layer.rot ?? 0) * Math.PI) / 180);
    if (layer.text !== undefined) {
      const lines = linesOf(layer);
      const px = textPx(layer.h, lines.length, H);
      ctx.font = textFont(layer.font, px);
      if (layer.font === "bold") ctx.letterSpacing = `${px * 0.04}px`;
      ctx.fillStyle = layer.color ?? "#121821";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * px * 1.2));
    } else {
      const img = await loadImage(layer.src);
      if (img) {
        // A soft shadow lifts each piece off the background, so overlaps read clearly.
        if (!layer.flat) {
          ctx.shadowColor = "rgba(18, 24, 33, 0.14)";
          ctx.shadowBlur = 16;
          ctx.shadowOffsetY = 6;
        }
        const [l, t, r, b] = layer.crop ?? [0, 0, 1, 1];
        ctx.drawImage(img, l * img.width, t * img.height, (r - l) * img.width, (b - t) * img.height, -w / 2, -h / 2, w, h);
        img.close();
      }
    }
    ctx.restore();
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the picture."))), "image/webp", 0.9));
  return { blob, width: W, height: H };
}

/** A picture's natural size (for adding it to the board at its own shape). */
export async function pictureSize(url: string): Promise<{ width: number; height: number } | null> {
  const img = await loadImage(url);
  if (!img) return null;
  const size = { width: img.width, height: img.height };
  img.close();
  return size;
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

export const isCutout = (url: string) => url.startsWith("/uploads/cut-") || url.startsWith("data:image/png;cut");

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
