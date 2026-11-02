"use client";

import type { ImageSegmenter } from "@mediapipe/tasks-vision";

/**
 * Shows the person's portrait with a different top color or hair color, on their own device (free; the photo isn't
 * sent anywhere for this). Google's MediaPipe multiclass selfie model (Apache-2.0, served from Virm's own site)
 * finds the clothes or the hair; only those pixels change color, keeping their folds, strands and shading, so the
 * face, pose, background and light stay exactly the same.
 */

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/selfie_multiclass_256x256.tflite";
/** The model's classes: 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 others. */
const PARTS = { hair: 1, top: 4 } as const;
/** How each part is recolored: how strongly, and how much of its own light and shade carries over. */
const BLEND = { hair: { strength: 0.85, shade: 1.1 }, top: { strength: 1, shade: 0.85 } } as const;
/** Longest side of the pictures made. */
const MAX_SIDE = 720;

let segmenterPromise: Promise<ImageSegmenter> | null = null;

function loadSegmenter(): Promise<ImageSegmenter> {
  segmenterPromise ??= (async () => {
    const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(WASM_PATH);
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: "IMAGE" as const,
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
    try {
      return await ImageSegmenter.createFromOptions(files, options("GPU"));
    } catch {
      return await ImageSegmenter.createFromOptions(files, options("CPU"));
    }
  })();
  segmenterPromise.catch(() => (segmenterPromise = null));
  return segmenterPromise;
}

const smooth = (lo: number, hi: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export type Recolored = { hex: string; url: string };

/** The portrait once per color, with only the top recolored. Null when no clothes were found. */
export const recolorTop = (portraitUrl: string, colors: string[]) => recolorPart(portraitUrl, colors, "top");

/** The portrait once per color, with only the hair recolored. Null when no hair was found. */
export const recolorHair = (portraitUrl: string, colors: string[]) => recolorPart(portraitUrl, colors, "hair");

/**
 * The portrait once per color, with one part recolored. Null when that part wasn't found (or the model can't run on
 * this device), so the page can say so instead of showing unchanged pictures.
 */
async function recolorPart(portraitUrl: string, colors: string[], part: keyof typeof PARTS): Promise<Recolored[] | null> {
  const [segmenter, blob] = await Promise.all([loadSegmenter(), fetch(portraitUrl).then((r) => r.blob())]);
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // How sure the model is, per pixel, that it's this part, brought to the picture's size with soft edges.
  const result = segmenter.segment(canvas);
  const mask = result.confidenceMasks?.[PARTS[part]];
  if (!mask) {
    result.close();
    return null;
  }
  const raw = mask.getAsFloat32Array();
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = mask.width;
  maskCanvas.height = mask.height;
  const maskPixels = new ImageData(mask.width, mask.height);
  for (let i = 0; i < raw.length; i++) maskPixels.data[i * 4 + 3] = Math.round(smooth(0.35, 0.8, raw[i]) * 255);
  result.close();
  maskCanvas.getContext("2d")!.putImageData(maskPixels, 0, 0);
  const scaled = document.createElement("canvas");
  scaled.width = w;
  scaled.height = h;
  const sctx = scaled.getContext("2d", { willReadFrequently: true })!;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(maskCanvas, 0, 0, w, h);
  const alpha = sctx.getImageData(0, 0, w, h).data;

  const original = ctx.getImageData(0, 0, w, h);
  const px = original.data;
  // The part's average brightness, so its folds, strands and shading carry over to the new color.
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < px.length; i += 4) {
    const a = alpha[i + 3] / 255;
    if (a < 0.5) continue;
    sum += (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * a;
    weight += a;
  }
  // Too little found to be a believable comparison.
  if (weight < w * h * 0.03) return null;
  const { strength, shade: shadeCarry } = BLEND[part];
  const mean = sum / weight;

  const out: Recolored[] = [];
  for (const hex of colors) {
    const [r, g, b] = rgb(hex);
    const pic = new ImageData(new Uint8ClampedArray(px), w, h);
    const d = pic.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = (alpha[i + 3] / 255) * strength;
      if (a === 0) continue;
      const shade = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] - mean) * shadeCarry;
      d[i] = d[i] * (1 - a) + Math.min(255, Math.max(0, r + shade)) * a;
      d[i + 1] = d[i + 1] * (1 - a) + Math.min(255, Math.max(0, g + shade)) * a;
      d[i + 2] = d[i + 2] * (1 - a) + Math.min(255, Math.max(0, b + shade)) * a;
    }
    ctx.putImageData(pic, 0, 0);
    const made = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (made) out.push({ hex, url: URL.createObjectURL(made) });
  }
  return out;
}
