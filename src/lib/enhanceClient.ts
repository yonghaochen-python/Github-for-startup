"use client";

import { cutOut } from "@/lib/cutout";

/**
 * The browser side of AI clothing enhancement (admins only for now). The server makes (or reuses) the tidied
 * picture; here its background is removed the same free, on-device way as every closet cut-out, its colors are
 * compared with the piece's own picture, and only what the person keeps is saved. Switching between the two
 * pictures afterwards is a plain switch: no AI, no cost.
 */

type Item = { id: string; imageUrl: string; plainUrl?: string | null; enhancedUrl?: string | null };

export type EnhancePreview = {
  /** The prepared picture (background removed when it could be), ready to save. */
  png: Blob;
  /** An object URL for showing it (let go with URL.revokeObjectURL when done). */
  url: string;
  /** Practice mode: nothing was sent, so the "enhanced" picture is the original. */
  practice: boolean;
  /** Shown again from the kept copy (nothing paid this time). */
  reused: boolean;
  /** How far the main colors moved (0 = the same; about 12+ is easy to see), or null if it couldn't be measured. */
  drift: number | null;
};

/** Above this, the colors look different enough to warn before keeping it. */
export const DRIFT_WARNING = 12;

const toBlob = (dataUrl: string) => fetch(dataUrl).then((r) => r.blob());

async function asPng(image: Blob): Promise<Blob> {
  if (image.type === "image/png") return image;
  const bitmap = await createImageBitmap(image);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/png" });
}

/** sRGB (0–255) to CIE Lab, for comparing colors the way eyes do. */
function lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** The garment's main color: the per-channel median of a cut-out's visible pixels (so a little jeans or skin in a worn
 * photo doesn't move it). Null without a cut-out or with too little to measure. */
async function mainColor(image: Blob): Promise<[number, number, number] | null> {
  const bitmap = await createImageBitmap(image);
  const side = 128;
  const canvas = new OffscreenCanvas(side, side);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, side, side);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, side, side);
  const ch: number[][] = [[], [], []];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    ch[0].push(data[i]);
    ch[1].push(data[i + 1]);
    ch[2].push(data[i + 2]);
  }
  if (ch[0].length < 200 || ch[0].length > side * side * 0.97) return null;
  const median = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1];
  return [median(ch[0]), median(ch[1]), median(ch[2])];
}

/**
 * AI pictures often come out a little duller than the real piece. This nudges the enhanced cut-out's colors back
 * toward the garment's main color in the person's own picture (gently, within limits, so prints and shading stay).
 * Returns the picture unchanged when either color can't be measured.
 */
async function matchColor(result: Blob, own: Blob): Promise<Blob> {
  const [target, got] = await Promise.all([mainColor(own), mainColor(result)]);
  if (!target || !got) return result;
  const gain = target.map((t, i) => Math.min(1.35, Math.max(0.75, (t + 4) / (got[i] + 4))));
  if (gain.every((g) => Math.abs(g - 1) < 0.02)) return result;
  const bitmap = await createImageBitmap(result);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = Math.min(255, d[i] * gain[0]);
    d[i + 1] = Math.min(255, d[i + 1] * gain[1]);
    d[i + 2] = Math.min(255, d[i + 2] * gain[2]);
  }
  ctx.putImageData(img, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

/**
 * The average color of the garment in a picture: the visible pixels of a cut-out, or the middle of a photo with a
 * background. Null when there's too little to measure.
 */
async function garmentColor(image: Blob): Promise<[number, number, number] | null> {
  const bitmap = await createImageBitmap(image);
  const side = 96;
  const canvas = new OffscreenCanvas(side, side);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, side, side);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, side, side);
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 128) transparent++;
  const hasCutout = transparent > side * side * 0.05;
  let n = 0;
  const sum = [0, 0, 0];
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const i = (y * side + x) * 4;
      if (hasCutout ? data[i + 3] < 128 : x < side * 0.25 || x > side * 0.75 || y < side * 0.25 || y > side * 0.75) continue;
      const [L, A, B] = lab(data[i], data[i + 1], data[i + 2]);
      sum[0] += L;
      sum[1] += A;
      sum[2] += B;
      n++;
    }
  }
  return n > 50 ? [sum[0] / n, sum[1] / n, sum[2] / n] : null;
}

/**
 * Asks for the enhanced picture (made once, then kept on the server), removes its background on this device, and
 * measures how far its colors moved from the piece's own picture. Nothing on the piece changes yet.
 */
export async function previewEnhancement(item: Item, mode: "tidy" | "flat" = "tidy"): Promise<EnhancePreview> {
  const res = await fetch(`/api/closet/items/${item.id}/enhance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const data = (await res.json().catch(() => ({}))) as { image?: string; practice?: boolean; reused?: boolean; error?: string };
  if (!res.ok || !data.image) throw new Error(data.error ?? "Couldn't enhance this picture right now. Your picture is unchanged.");
  const made = await toBlob(data.image);
  // The same background removal as every closet piece (free, on this device); the white-background version if it can't.
  const cut = (await cutOut(made).catch(() => null)) ?? (await asPng(made));
  const plainUrl = item.enhancedUrl && item.imageUrl === item.enhancedUrl ? (item.plainUrl ?? item.imageUrl) : item.imageUrl;
  const plain = await fetch(plainUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
  // Colors brought back to the real piece's (AI pictures tend to come out a little duller).
  const png = plain ? await matchColor(cut, plain).catch(() => cut) : cut;
  const [a, b] = await Promise.all([plain ? garmentColor(plain).catch(() => null) : null, garmentColor(png).catch(() => null)]);
  const drift = a && b ? Math.round(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])) : null;
  return { png, url: URL.createObjectURL(png), practice: Boolean(data.practice), reused: Boolean(data.reused), drift };
}

/** Keeps the enhanced picture and shows it (the piece's own pictures stay as they are). */
export async function keepEnhancement<T extends Item>(item: T, png: Blob): Promise<T> {
  const form = new FormData();
  form.append("picture", png, "enhanced.png");
  const res = await fetch(`/api/closet/items/${item.id}/enhance`, { method: "PUT", body: form });
  const data = (await res.json().catch(() => ({}))) as { item?: T; error?: string };
  if (!res.ok || !data.item) throw new Error(data.error ?? "Couldn't save the enhanced picture.");
  return data.item;
}

/** ✦: shows the enhanced picture or the piece's own (no AI, no cost). */
export async function showPicture<T extends Item>(item: T, show: "enhanced" | "original"): Promise<T> {
  const res = await fetch(`/api/closet/items/${item.id}/enhance`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ show }),
  });
  const data = (await res.json().catch(() => ({}))) as { item?: T; error?: string };
  if (!res.ok || !data.item) throw new Error(data.error ?? "Couldn't switch the picture.");
  return data.item;
}
