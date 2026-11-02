"use client";

import { loadLandmarker } from "@/lib/autoFrame";
import type { PortraitChecks } from "@/lib/studioModules";

/**
 * Checks an AI Stylist portrait on the device before it's saved (the photo isn't sent anywhere for this): size,
 * brightness, and whether a face is visible and big enough to read, using the same MediaPipe body model as the
 * try-on photo's auto-framing. It can also cut a head-and-shoulders portrait out of the full-body try-on photo.
 */

/** Longest side of the saved portrait. */
const SAVE_SIDE = 1600;
// MediaPipe pose landmarks: nose, eyes, ears, shoulders.
const NOSE = 0;
const EYES = [2, 5];
const EARS = [7, 8];
const SHOULDERS = [11, 12];
/** Eye-to-eye distance, as a share of the photo's shorter side, below which the face is too small to read. */
const MIN_EYE_SHARE = 0.07;

type Point = { x: number; y: number; visibility?: number };

async function faceLandmarks(bitmap: ImageBitmap): Promise<Point[] | null> {
  try {
    const landmarker = await loadLandmarker();
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = landmarker.detect(canvas);
    result.segmentationMasks?.forEach((m) => m.close());
    const points = result.landmarks[0];
    if (!points) return [];
    const seen = (i: number) => (points[i]?.visibility ?? 1) > 0.5;
    return seen(NOSE) && EYES.every(seen) ? points : [];
  } catch {
    return null;
  }
}

function brightnessOf(bitmap: ImageBitmap): number {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, 48, 48);
  const { data } = ctx.getImageData(0, 0, 48, 48);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return sum / (data.length / 4);
}

function toJpeg(source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): Promise<Blob> {
  const scale = Math.min(1, SAVE_SIDE / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("photo"))), "image/jpeg", 0.9));
}

/** The photo ready to save (shrunk), and its checks. */
export async function preparePortrait(photo: Blob): Promise<{ blob: Blob; checks: PortraitChecks }> {
  const bitmap = await createImageBitmap(photo);
  try {
    const points = await faceLandmarks(bitmap);
    const short = Math.min(bitmap.width, bitmap.height);
    let face: PortraitChecks["face"] = "unknown";
    if (points && points.length === 0) face = "none";
    else if (points) {
      const eyes = Math.hypot((points[EYES[0]].x - points[EYES[1]].x) * bitmap.width, (points[EYES[0]].y - points[EYES[1]].y) * bitmap.height);
      face = eyes / short >= MIN_EYE_SHARE ? "clear" : "small";
    }
    const blob = await toJpeg(bitmap, 0, 0, bitmap.width, bitmap.height);
    const scale = Math.min(1, SAVE_SIDE / Math.max(bitmap.width, bitmap.height));
    return {
      blob,
      checks: { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale), brightness: brightnessOf(bitmap), face },
    };
  } finally {
    bitmap.close();
  }
}

/** A head-and-shoulders crop of a full-body photo, or null when no face is found. */
export async function cropPortrait(photo: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(photo);
  try {
    const points = await faceLandmarks(bitmap);
    if (!points?.length) return null;
    const px = (i: number) => ({ x: points[i].x * bitmap.width, y: points[i].y * bitmap.height });
    const eyeGap = Math.hypot(px(EYES[0]).x - px(EYES[1]).x, px(EYES[0]).y - px(EYES[1]).y);
    const earGap = Math.abs(px(EARS[0]).x - px(EARS[1]).x);
    const shoulderGap = Math.abs(px(SHOULDERS[0]).x - px(SHOULDERS[1]).x);
    // Wide enough for the shoulders, in a 4:5 frame with the face in the upper part.
    const width = Math.min(bitmap.width, Math.max(shoulderGap * 2.1, earGap * 4.2, eyeGap * 10));
    const height = Math.min(bitmap.height, width * 1.25);
    const nose = px(NOSE);
    const left = Math.max(0, Math.min(bitmap.width - width, nose.x - width / 2));
    const top = Math.max(0, Math.min(bitmap.height - height, nose.y - height * 0.36));
    return await toJpeg(bitmap, left, top, width, height);
  } finally {
    bitmap.close();
  }
}
