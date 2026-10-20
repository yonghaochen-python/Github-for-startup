"use client";

import type { PoseLandmarker } from "@mediapipe/tasks-vision";

/**
 * Auto-framing for the full-body photo: finds the person on the device (Google's MediaPipe pose model, served
 * from Virm's own site, so the photo never leaves the browser for this) and, when their feet are in the photo,
 * crops from just above the head to just below the feet so they fill the frame. Without feet the photo is kept
 * as it is. Anything unexpected (no person found, the model can't load) also keeps the photo as it is.
 */

export type FrameResult =
  | { framed: true; blob: Blob }
  | { framed: false; reason: "no-person" | "no-feet" | "already-fills" | "unavailable" };

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/pose_landmarker_lite.task";
/** The model only needs a small copy of the photo to find the person. */
const DETECT_MAX_SIDE = 640;
/** People taking up more than this share of the photo's height are left alone. */
const FILLS_SHARE = 0.86;
/** Breathing room above the head and below the feet, as a share of the person's height. */
const PAD_TOP = 0.06;
const PAD_BOTTOM = 0.035;
const MIN_VISIBLE = 0.5;

// Pose landmark numbers (MediaPipe's 33-point body model): [left, right].
const NOSE = 0;
const HEELS = [29, 30];
const TOES = [31, 32];

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

function loadLandmarker(): Promise<PoseLandmarker> {
  landmarkerPromise ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(WASM_PATH);
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: "IMAGE" as const,
      numPoses: 1,
      outputSegmentationMasks: true,
    });
    try {
      return await PoseLandmarker.createFromOptions(files, options("GPU"));
    } catch {
      return await PoseLandmarker.createFromOptions(files, options("CPU"));
    }
  })();
  landmarkerPromise.catch(() => (landmarkerPromise = null));
  return landmarkerPromise;
}

/** The person's top and bottom edges (0–1 of the photo's height) and left/right edges (0–1 of its width). */
function personBox(mask: Float32Array, w: number, h: number) {
  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] > 0.5) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom < 0) return null;
  return { top: top / h, bottom: (bottom + 1) / h, left: left / w, right: (right + 1) / w };
}

export async function frameToBody(photo: Blob): Promise<FrameResult> {
  let landmarker: PoseLandmarker;
  let image: ImageBitmap;
  try {
    [landmarker, image] = await Promise.all([loadLandmarker(), createImageBitmap(photo)]);
  } catch {
    return { framed: false, reason: "unavailable" };
  }

  try {
    const W = image.width;
    const H = image.height;
    const scale = Math.min(1, DETECT_MAX_SIDE / Math.max(W, H));
    const small = document.createElement("canvas");
    small.width = Math.round(W * scale);
    small.height = Math.round(H * scale);
    small.getContext("2d")!.drawImage(image, 0, 0, small.width, small.height);

    const result = landmarker.detect(small);
    const pose = result.landmarks[0];
    const mask = result.segmentationMasks?.[0];
    const box = mask ? personBox(mask.getAsFloat32Array(), mask.width, mask.height) : null;
    result.segmentationMasks?.forEach((m) => m.close());
    if (!pose || !box || (pose[NOSE]?.visibility ?? 1) < MIN_VISIBLE) return { framed: false, reason: "no-person" };

    // Feet count as "in the photo" when a heel or toe on each side is clearly seen inside the frame. (The body
    // outline isn't used for this: it often takes in the floor or a shadow under the shoes and reaches the edge.)
    const seen = (i: number) => (pose[i]?.visibility ?? 0) >= MIN_VISIBLE && pose[i].y <= 0.995;
    const feetIn = (seen(HEELS[0]) || seen(TOES[0])) && (seen(HEELS[1]) || seen(TOES[1]));
    if (!feetIn) return { framed: false, reason: "no-feet" };

    // Top of the head from the outline; bottom of the feet from the lowest visible heel or toe.
    const personTop = box.top;
    const personBottom = Math.max(...[...HEELS, ...TOES].filter(seen).map((i) => pose[i].y));
    const personH = personBottom - personTop;
    if (personH <= 0) return { framed: false, reason: "no-person" };
    if (personH >= FILLS_SHARE) return { framed: false, reason: "already-fills" };

    // Head-to-toe crop with a little room, in a 3:4 portrait shape when the photo allows, centered on the person.
    const top = Math.max(0, personTop - personH * PAD_TOP) * H;
    const bottom = Math.min(1, personBottom + personH * PAD_BOTTOM) * H;
    const cropH = bottom - top;
    const personW = (box.right - box.left) * W;
    const cropW = Math.min(W, Math.max(cropH * 0.75, personW * 1.12));
    const centerX = ((box.left + box.right) / 2) * W;
    const left = Math.min(Math.max(0, centerX - cropW / 2), W - cropW);

    const out = document.createElement("canvas");
    out.width = Math.round(cropW);
    out.height = Math.round(cropH);
    out.getContext("2d")!.drawImage(image, left, top, cropW, cropH, 0, 0, out.width, out.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.95)
    );
    return { framed: true, blob };
  } catch {
    return { framed: false, reason: "unavailable" };
  } finally {
    image.close();
  }
}

/** Starts downloading the model in the background (e.g. when the photo step opens), so framing feels instant. */
export function preloadAutoFrame() {
  loadLandmarker().catch(() => {});
}

