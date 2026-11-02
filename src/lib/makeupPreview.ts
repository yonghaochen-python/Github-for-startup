"use client";

import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * A light makeup preview on the person's own portrait, made on their device (free; the photo isn't sent anywhere
 * for this): a lip color and a blush, placed with Google's MediaPipe face landmarks (Apache-2.0, served by Virm,
 * meant for AR effects; it doesn't recognize or identify anyone). Only color is laid over the lips and cheeks, softly,
 * so the face itself is never reshaped.
 */

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/face_landmarker.task";
const MAX_SIDE = 900;

// MediaPipe face mesh points: the outer and inner lip edges, the cheek apples, and the face's sides.
const OUTER_LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const INNER_LIPS = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
const CHEEKS = [205, 425];
const FACE_SIDES = [234, 454];

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function loadLandmarker(): Promise<FaceLandmarker> {
  landmarkerPromise ??= (async () => {
    const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(WASM_PATH);
    const options = (delegate: "GPU" | "CPU") => ({ baseOptions: { modelAssetPath: MODEL_PATH, delegate }, runningMode: "IMAGE" as const, numFaces: 1 });
    try {
      return await FaceLandmarker.createFromOptions(files, options("GPU"));
    } catch {
      return await FaceLandmarker.createFromOptions(files, options("CPU"));
    }
  })();
  landmarkerPromise.catch(() => (landmarkerPromise = null));
  return landmarkerPromise;
}

export type MakeupCanvas = { canvas: HTMLCanvasElement; base: ImageData; points: NormalizedLandmark[] };

/** Finds the face once per portrait. Null when no face is found, so the page can say so. */
export async function prepareMakeup(portraitUrl: string): Promise<MakeupCanvas | null> {
  const [landmarker, blob] = await Promise.all([loadLandmarker(), fetch(portraitUrl).then((r) => r.blob())]);
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const points = landmarker.detect(canvas).faceLandmarks[0];
  if (!points) return null;
  return { canvas, base: ctx.getImageData(0, 0, canvas.width, canvas.height), points };
}

function path(ctx: CanvasRenderingContext2D, points: NormalizedLandmark[], ids: number[], w: number, h: number) {
  ids.forEach((id, i) => {
    const x = points[id].x * w;
    const y = points[id].y * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/** Draws the portrait with the chosen lip color and blush (either may be left out). */
export function drawMakeup(target: HTMLCanvasElement, prepared: MakeupCanvas, look: { lip?: string; blush?: string }) {
  const { base, points } = prepared;
  const w = base.width;
  const h = base.height;
  target.width = w;
  target.height = h;
  const ctx = target.getContext("2d")!;
  ctx.putImageData(base, 0, 0);
  const faceWidth = Math.abs(points[FACE_SIDES[1]].x - points[FACE_SIDES[0]].x) * w;

  if (look.blush) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    for (const id of CHEEKS) {
      const x = points[id].x * w;
      const y = points[id].y * h;
      const r = faceWidth * 0.17;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `${look.blush}66`);
      g.addColorStop(1, `${look.blush}00`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  if (look.lip) {
    // The lips only (the mouth opening is left out), softened at the edges, multiplied so the lip texture shows.
    ctx.save();
    ctx.beginPath();
    path(ctx, points, OUTER_LIPS, w, h);
    path(ctx, points, INNER_LIPS, w, h);
    ctx.filter = `blur(${Math.max(1, faceWidth * 0.006)}px)`;
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = look.lip;
    ctx.fill("evenodd");
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.35;
    ctx.fill("evenodd");
    ctx.restore();
  }
}
