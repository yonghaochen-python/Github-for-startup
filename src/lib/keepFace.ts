"use client";

import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * Puts the person's real face back on a try-on picture. Try-on AI redraws the whole picture, and every pass changes the
 * face a little (an outfit dressed one piece at a time goes through it several times), until it no longer looks like
 * them. Their own face, from the photo the try-on started from, is lined up with the face in the result (Google's
 * MediaPipe face landmarks, served by Virm, on the device; nothing is sent anywhere) and blended in with soft edges,
 * inside the face outline only, so hair, neck and the new clothes stay as the try-on made them. Free.
 * Returns null when a face can't be found in either picture (the result is then kept as it is).
 */

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/face_landmarker.task";

// MediaPipe face mesh: the outline of the face, from the forehead round the chin.
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

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

type Pt = { x: number; y: number };

/**
 * The face's landmarks in the picture's own pixels. In a full-length photo the face is small, so the top part of the
 * picture is searched enlarged when the whole picture finds nothing.
 */
function findFace(landmarker: FaceLandmarker, img: ImageBitmap): Pt[] | null {
  const tries: [number, number][] = [
    [0, 1], // the whole picture
    [0, 0.45], // the top part, enlarged
    [0, 0.3],
  ];
  for (const [top, part] of tries) {
    const sh = img.height * part;
    const scale = Math.min(4, 1280 / Math.max(img.width, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext("2d")!.drawImage(img, 0, img.height * top, img.width, sh, 0, 0, canvas.width, canvas.height);
    const found: NormalizedLandmark[] | undefined = landmarker.detect(canvas).faceLandmarks[0];
    if (found) return found.map((p) => ({ x: p.x * img.width, y: img.height * top + p.y * sh }));
  }
  return null;
}

/** The best scale, turn and shift taking `from` onto `to` (least squares over every landmark). */
function similarity(from: Pt[], to: Pt[]) {
  const n = from.length;
  const mean = (ps: Pt[]) => ps.reduce((m, p) => ({ x: m.x + p.x / n, y: m.y + p.y / n }), { x: 0, y: 0 });
  const mf = mean(from);
  const mt = mean(to);
  let a = 0;
  let b = 0;
  let norm = 0;
  for (let i = 0; i < n; i++) {
    const fx = from[i].x - mf.x;
    const fy = from[i].y - mf.y;
    const tx = to[i].x - mt.x;
    const ty = to[i].y - mt.y;
    a += fx * tx + fy * ty;
    b += fx * ty - fy * tx;
    norm += fx * fx + fy * fy;
  }
  const c = a / norm; // scale × cos
  const s = b / norm; // scale × sin
  return { c, s, ex: mt.x - (c * mf.x - s * mf.y), ey: mt.y - (s * mf.x + c * mf.y) };
}

export async function keepFace(original: Blob, result: Blob): Promise<Blob | null> {
  const [landmarker, orig, res] = await Promise.all([loadLandmarker(), createImageBitmap(original), createImageBitmap(result)]);
  try {
    const from = findFace(landmarker, orig);
    const to = findFace(landmarker, res);
    if (!from || !to) return null;
    const t = similarity(from, to);
    const scale = Math.hypot(t.c, t.s);
    // A face that moved or turned a lot means the poses differ: pasting would look wrong, so leave the result alone.
    const angle = Math.abs(Math.atan2(t.s, t.c));
    if (scale < 0.6 || scale > 1.7 || angle > 0.35) return null;

    const out = document.createElement("canvas");
    out.width = res.width;
    out.height = res.height;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(res, 0, 0);

    // The original photo, lined up with the result.
    const face = document.createElement("canvas");
    face.width = res.width;
    face.height = res.height;
    const fctx = face.getContext("2d")!;
    fctx.setTransform(t.c, t.s, -t.s, t.c, t.ex, t.ey);
    fctx.drawImage(orig, 0, 0);
    fctx.setTransform(1, 0, 0, 1, 0, 0);

    // Only inside the face's outline (drawn a little smaller, so hair at the edges stays the try-on's), soft-edged.
    const oval = FACE_OVAL.map((i) => to[i]);
    const cx = oval.reduce((sum, p) => sum + p.x, 0) / oval.length;
    const cy = oval.reduce((sum, p) => sum + p.y, 0) / oval.length;
    const width = Math.max(...oval.map((p) => p.x)) - Math.min(...oval.map((p) => p.x));
    const mask = document.createElement("canvas");
    mask.width = res.width;
    mask.height = res.height;
    const mctx = mask.getContext("2d")!;
    mctx.filter = `blur(${Math.max(2, width * 0.06)}px)`;
    mctx.beginPath();
    oval.forEach((p, i) => {
      const x = cx + (p.x - cx) * 0.9;
      const y = cy + (p.y - cy) * 0.9;
      if (i === 0) mctx.moveTo(x, y);
      else mctx.lineTo(x, y);
    });
    mctx.closePath();
    mctx.fillStyle = "#000";
    mctx.fill();
    fctx.globalCompositeOperation = "destination-in";
    fctx.drawImage(mask, 0, 0);

    ctx.drawImage(face, 0, 0);
    return await new Promise<Blob | null>((done) => out.toBlob(done, "image/jpeg", 0.92));
  } finally {
    orig.close();
    res.close();
  }
}
