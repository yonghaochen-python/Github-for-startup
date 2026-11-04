import { loadSegmenter } from "@/lib/recolor";

/**
 * A full-body picture trimmed to the person, head to toe: the background on the left and right (and any empty space
 * above and below) is cut away. Found on the device with the same free MediaPipe model the closet uses; nothing is
 * uploaded. Resolves to a picture URL, or null when no person is found (show the original then).
 */

const SAMPLE = 384; // the side the model looks at
const PAD_X = 0.08; // room kept beside the person (share of their width)
const PAD_Y = 0.025; // room kept above the head and below the feet (share of the picture's height)

const cache = new Map<string, Promise<string | null>>();

export function cropToPerson(src: string): Promise<string | null> {
  let job = cache.get(src);
  if (!job) {
    job = crop(src).catch(() => null);
    cache.set(src, job);
  }
  return job;
}

async function crop(src: string): Promise<string | null> {
  const [segmenter, blob] = await Promise.all([loadSegmenter(), fetch(src).then((r) => (r.ok ? r.blob() : Promise.reject()))]);
  const bitmap = await createImageBitmap(blob);
  const W = bitmap.width;
  const H = bitmap.height;

  const scale = SAMPLE / Math.max(W, H);
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(W * scale));
  small.height = Math.max(1, Math.round(H * scale));
  small.getContext("2d")!.drawImage(bitmap, 0, 0, small.width, small.height);

  const result = segmenter.segment(small);
  const background = result.confidenceMasks?.[0];
  if (!background) {
    result.close();
    bitmap.close();
    return null;
  }
  const bg = background.getAsFloat32Array();
  const mw = background.width;
  const mh = background.height;
  result.close();

  // Columns and rows where enough of the person shows (a few stray pixels don't count).
  const cols = new Array<number>(mw).fill(0);
  const rows = new Array<number>(mh).fill(0);
  let total = 0;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      if (bg[y * mw + x] < 0.5) {
        cols[x]++;
        rows[y]++;
        total++;
      }
    }
  }
  if (total < mw * mh * 0.02) {
    bitmap.close();
    return null;
  }
  const span = (counts: number[], min: number) => {
    const first = counts.findIndex((c) => c >= min);
    let last = counts.length - 1;
    while (last > first && counts[last] < min) last--;
    return [first, last + 1] as const;
  };
  const [x0, x1] = span(cols, Math.max(2, mh * 0.01));
  const [y0, y1] = span(rows, Math.max(2, mw * 0.01));

  // Back to the full picture, with a little room kept around the person.
  const padX = (x1 - x0) * PAD_X;
  const left = Math.max(0, ((x0 - padX) / mw) * W);
  const right = Math.min(W, ((x1 + padX) / mw) * W);
  const top = Math.max(0, (y0 / mh - PAD_Y) * H);
  const bottom = Math.min(H, (y1 / mh + PAD_Y) * H);
  const cw = Math.round(right - left);
  const ch = Math.round(bottom - top);
  // Already tight (nothing worth trimming): keep the original.
  if (cw >= W * 0.92 && ch >= H * 0.92) {
    bitmap.close();
    return null;
  }

  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d")!.drawImage(bitmap, left, top, cw, ch, 0, 0, cw, ch);
  bitmap.close();
  const jpeg = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", 0.92));
  return jpeg ? URL.createObjectURL(jpeg) : null;
}
