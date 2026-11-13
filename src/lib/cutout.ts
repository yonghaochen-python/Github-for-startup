"use client";

import type { InferenceSession } from "onnxruntime-web";
import { loadSegmenter } from "@/lib/recolor";

/**
 * Background removal for clothing photos, run on the person's own device (no service, no cost, the photo isn't sent
 * anywhere for this). Uses U²-Net-p (Apache-2.0, from the rembg project), served by this site from /models, with
 * Microsoft's onnxruntime-web (MIT) served from /ort. Returns a PNG with a transparent background, trimmed to the
 * piece, or null when the result doesn't look like a clean cut-out (then the original photo is kept).
 *
 * U²-Net keeps whatever stands out most, which in a photo of clothes being worn can be an arm instead of the top. So
 * MediaPipe's multiclass selfie model (already on the site for the Stylist) also looks at the photo: when a person is
 * in it, only what it sees as clothes is kept, and a cut-out that is still mostly skin is refused.
 */

const MODEL_PATH = "/models/u2netp.onnx";
const WASM_PATH = "/ort/ort-wasm-simd-threaded.wasm";
const SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
/** Longest side of the saved cut-out. */
const MAX_SIDE = 1200;

let session: Promise<InferenceSession> | null = null;

function loadSession(): Promise<InferenceSession> {
  session ??= (async () => {
    const ort = await import("onnxruntime-web/wasm");
    // The script part is bundled with the app; only the engine file is fetched from the site.
    ort.env.wasm.wasmPaths = { wasm: WASM_PATH };
    ort.env.wasm.numThreads = 1;
    return ort.InferenceSession.create(MODEL_PATH, { executionProviders: ["wasm"] });
  })().catch((err) => {
    session = null;
    throw err;
  });
  return session;
}

/** Starts downloading the model early (e.g. when Add Clothes opens), so the first cut-out feels quicker. */
export function warmUpCutout(): void {
  loadSession().catch(() => {});
  // The second model (which tells worn clothes from skin and hair) too, so neither loads while someone waits.
  loadSegmenter().catch(() => {});
}

/** The model's guess, per pixel at 320×320, of how much belongs to the piece (0–1). */
async function predictMask(bitmap: ImageBitmap): Promise<Float32Array> {
  const ort = await import("onnxruntime-web/wasm");
  const s = await loadSession();
  const canvas = new OffscreenCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  let max = 1;
  for (let i = 0; i < data.length; i += 4) max = Math.max(max, data[i], data[i + 1], data[i + 2]);
  const input = new Float32Array(3 * SIZE * SIZE);
  for (let p = 0; p < SIZE * SIZE; p++) {
    for (let c = 0; c < 3; c++) input[c * SIZE * SIZE + p] = (data[p * 4 + c] / max - MEAN[c]) / STD[c];
  }
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
  const raw = out[s.outputNames[0]].data as Float32Array;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of raw) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const mask = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < mask.length; i++) mask[i] = hi > lo ? (raw[i] - lo) / (hi - lo) : 0;
  return mask;
}

/**
 * Of a person in the photo, per pixel at 320×320: how sure the model is that it's skin or hair, and that it's clothes; and
 * how much of the photo is hair, face, body skin, and clothes.
 */
type PersonParts = { skin: Float32Array; clothes: Float32Array; hair: number; face: number; body: number; clothing: number };

/** The multiclass selfie model's view of the photo (null if it can't run here: then U²-Net works alone). */
async function personParts(bitmap: ImageBitmap): Promise<PersonParts | null> {
  try {
    const segmenter = await loadSegmenter();
    const result = segmenter.segment(bitmap);
    // Classes: 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 others (e.g. bags, hats).
    const masks = result.confidenceMasks;
    if (!masks || masks.length < 6) {
      result.close();
      return null;
    }
    const [, hair, body, face, cloth, other] = masks.map((m) => m.getAsFloat32Array());
    const mw = masks[0].width;
    const mh = masks[0].height;
    result.close();
    const skin = new Float32Array(SIZE * SIZE);
    const clothes = new Float32Array(SIZE * SIZE);
    let hairs = 0;
    let faces = 0;
    let bodySkin = 0;
    let clothing = 0;
    for (let y = 0; y < SIZE; y++) {
      const my = Math.min(mh - 1, Math.floor((y * mh) / SIZE));
      for (let x = 0; x < SIZE; x++) {
        const j = my * mw + Math.min(mw - 1, Math.floor((x * mw) / SIZE));
        const i = y * SIZE + x;
        skin[i] = body[j] + face[j] + hair[j];
        clothes[i] = cloth[j] + other[j];
        if (hair[j] > 0.5) hairs++;
        if (face[j] > 0.5) faces++;
        if (body[j] > 0.5) bodySkin++;
        if (clothes[i] > 0.5) clothing++;
      }
    }
    const n = SIZE * SIZE;
    return { skin, clothes, hair: hairs / n, face: faces / n, body: bodySkin / n, clothing: clothing / n };
  } catch {
    return null;
  }
}

/** Cuts the background out of a clothing picture. Null means "keep the original" (nothing clear was found). */
export async function cutOut(image: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(image);
  try {
    const [mask, parts] = await Promise.all([predictMask(bitmap), personParts(bitmap)]);
    // Hair, a face with some skin, or plenty of skin, with clothes on: someone is wearing it, so keep only their
    // clothes (not their arms, face or hair). A little "skin" or "face" alone isn't enough: brown leather can look
    // like either.
    const worn =
      parts !== null &&
      parts.clothing > 0.05 &&
      (parts.hair > 0.003 || (parts.face > 0.003 && parts.body > 0.01) || parts.body > 0.08);
    // More skin than clothes (e.g. arms folded over a top): no clean cut-out is possible, so keep the photo.
    if (worn && parts.body > parts.clothing * 0.6) return null;
    // Real hair in the photo (e.g. sunglasses on a head) means a cut-out could keep the person instead of the piece.
    const person = worn || (parts !== null && parts.hair > 0.02);
    if (worn) for (let i = 0; i < mask.length; i++) mask[i] = Math.max(0, Math.min(1, parts.clothes[i]) - parts.skin[i]);

    // Sharpen the soft edges a little, and find how much of the picture is the piece.
    const alpha = new Uint8ClampedArray(SIZE * SIZE * 4);
    let kept = 0;
    let skinKept = 0;
    for (let i = 0; i < mask.length; i++) {
      const a = Math.min(1, Math.max(0, (mask[i] - 0.15) / 0.7));
      alpha[i * 4 + 3] = Math.round(a * 255);
      if (a > 0.5) {
        kept++;
        if (person && parts !== null && parts.skin[i] > 0.5) skinKept++;
      }
    }
    const share = kept / mask.length;
    // Almost nothing, or almost everything: not a believable cut-out.
    if (share < 0.03 || share > 0.97) return null;
    // Mostly skin or hair (an arm, a hand, a face): that's not the piece.
    if (skinKept > kept * 0.25) return null;

    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const maskCanvas = new OffscreenCanvas(SIZE, SIZE);
    maskCanvas.getContext("2d")!.putImageData(new ImageData(alpha, SIZE, SIZE), 0, 0);

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    ctx.globalCompositeOperation = "destination-in";
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(maskCanvas, 0, 0, w, h);

    // Trim the empty edges so pieces sit close together on the shelf.
    const { data } = ctx.getImageData(0, 0, w, h);
    let top = h;
    let left = w;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 24) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    if (right < left || bottom < top) return null;
    const pad = Math.round(Math.max(w, h) * 0.02);
    left = Math.max(0, left - pad);
    top = Math.max(0, top - pad);
    right = Math.min(w - 1, right + pad);
    bottom = Math.min(h - 1, bottom + pad);
    const trimmed = new OffscreenCanvas(right - left + 1, bottom - top + 1);
    trimmed.getContext("2d")!.drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
    return await trimmed.convertToBlob({ type: "image/png" });
  } finally {
    bitmap.close();
  }
}
