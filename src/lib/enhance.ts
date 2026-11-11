import { createHash } from "node:crypto";
import { env } from "cloudflare:workers";
import { isDevMode } from "@/lib/auth";

/**
 * AI clothing enhancement (admins only for now): one closet picture tidied into a clean catalog-style picture by
 * Black Forest Labs' FLUX 3 Image, on the same BFL account and key as photo try-on (server only; the key never
 * reaches the browser). Docs: https://docs.bfl.ai/flux_3/flux3_image_layout
 *
 * - The picture is sent once. The result is kept privately under a fingerprint of the exact picture sent plus the
 *   instruction version, so the same picture is never sent again (switching back and forth never calls the AI).
 * - BFL's reply says what the request really cost (`cost`, in credits of $0.01); that's what gets recorded.
 * - Practice mode: on the local copy (and whenever ENHANCE_PROVIDER=mock) nothing is sent and the picture comes back
 *   unchanged, so testing never costs anything. ENHANCE_PROVIDER=bfl sends for real even locally.
 */

/** Bump when the instruction changes, so pictures enhanced with the old one aren't reused. */
export const ENHANCE_VERSION = "flux3-768-v1";
const MODEL_PATH = "/v1/flux-3-image";
const SUBMIT_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;
/** FLUX 3 takes reference pictures up to 16 MP; very large files are refused here instead of sent. */
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

/**
 * Tidy the presentation only. Everything that makes the piece itself is kept exactly, and nothing hidden is made up
 * (a folded or cut-off piece stays as much as can be seen).
 */
export const ENHANCE_PROMPT = [
  "Present this exact clothing item as a clean e-commerce product photo: front view, laid flat and neatly arranged,",
  "smoothed where the item is fully visible, evenly lit, on a plain pure white background, with no person, hanger,",
  "hands, props or text added.",
  "Keep the item exactly the same: identical colors and shades; identical patterns and prints at the same scale and",
  "position; every logo, label, graphic and piece of text exactly as it is (same size, position, spelling and color);",
  "the same neckline, collar, sleeve length, buttons, zips, pockets, seams, hem, fabric texture and overall shape.",
  "Do not add, remove, move or redesign anything. If part of the item is hidden, folded under or cut off in the photo,",
  "do not invent it: show only what can be seen.",
].join(" ");

/**
 * "Lay it flat": for a folded or bunched-up piece. Unlike Enhance, the AI may complete the parts it can't see (sleeves,
 * length, the rest of the body), but only plainly, continuing what is visible, never adding new details. The person
 * always sees it beside their own picture and chooses; the original is never replaced on its own.
 */
export const FLAT_PROMPT = [
  "This photo shows one clothing item that is folded, rolled or bunched up. Show the same item unfolded and laid out",
  "completely flat as a clean e-commerce flat-lay product photo: front view, symmetrical, sleeves and legs straightened",
  "out at its natural full length and shape, smoothed, evenly lit, on a plain pure white background, with no person,",
  "hanger, hands, props or text added.",
  "Keep everything visible exactly the same: identical colors and shades, fabric and texture; patterns and prints at",
  "the same scale; every logo, label, graphic and piece of text exactly as it is; the same collar, neckline, buttons,",
  "zips, pockets, cuffs, seams and hem.",
  "Where part of the item is hidden by the folding, continue it plainly in the same fabric, color and pattern, matching",
  "the visible parts and the item's type. Never add new logos, graphics, text, pockets, trims or details that can't be",
  "seen in the photo.",
].join(" ");
/** Changing an instruction gets its own kept copies (an old result is never shown for a new instruction). */
export const FLAT_VERSION = "flux3-768-flat-v1";
export type EnhanceMode = "tidy" | "flat";

export class EnhanceError extends Error {
  constructor(
    readonly code: "not_configured" | "declined" | "busy" | "failed" | "too_large",
    message: string
  ) {
    super(message);
  }
}

export type EnhanceResult = {
  /** The tidied picture (white background), as a data URL. */
  imageDataUrl: string;
  /** Practice mode: nothing was sent and the picture is the original. */
  practice: boolean;
  /** Shown again from the private copy (no AI call, no cost). */
  reused: boolean;
  /** What BFL charged, in millionths of a dollar (null when practice, reused, or not reported). */
  costMicros: number | null;
};

const practiceMode = () => (process.env.ENHANCE_PROVIDER ?? (isDevMode() ? "mock" : "bfl")) === "mock";

/** Where a picture's result is kept: per person, by a fingerprint of the exact bytes plus the instruction version. */
export function enhanceKey(userId: string, bytes: Uint8Array, mode: EnhanceMode = "tidy"): string {
  const hash = createHash("sha256").update(mode === "flat" ? FLAT_VERSION : ENHANCE_VERSION).update(bytes).digest("hex");
  return `private/enhance/${userId}/${hash}`;
}

const toDataUrl = (bytes: Uint8Array, type: string) => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new EnhanceError("failed", "The enhancement service took too long to respond. Please try again.");
  } finally {
    clearTimeout(timer);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends one picture to FLUX 3 and waits for it. Returns the result's bytes and what it cost. */
async function runFlux3(bytes: Uint8Array, prompt: string): Promise<{ bytes: Uint8Array; type: string; costMicros: number | null }> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw new EnhanceError("not_configured", "AI enhancement isn't connected yet.");
  const baseUrl = (process.env.BFL_BASE_URL ?? "https://api.bfl.ai").replace(/\/$/, "");
  const startedAt = Date.now();
  const res = await fetchWithTimeout(
    `${baseUrl}${MODEL_PATH}`,
    {
      method: "POST",
      headers: { accept: "application/json", "Content-Type": "application/json", "x-key": apiKey },
      // Only fields FLUX 3 accepts (it rejects unknown ones). No web research: only the photo is used.
      body: JSON.stringify({
        prompt,
        images: [Buffer.from(bytes).toString("base64")],
        resolution: "768sq",
        aspect_ratio: "1:1",
        grounding: false,
      }),
    },
    SUBMIT_TIMEOUT_MS
  );
  if (!res.ok) {
    if (res.status === 402) throw new EnhanceError("not_configured", "AI enhancement is paused (the service's credits have run out).");
    if (res.status === 401 || res.status === 403) throw new EnhanceError("not_configured", "AI enhancement isn't connected correctly (the key was rejected).");
    if (res.status === 429) throw new EnhanceError("busy", "The enhancement service is busy. Please try again in a minute.");
    if (res.status === 422 || res.status === 400) throw new EnhanceError("declined", "The enhancement service couldn't use this picture.");
    throw new EnhanceError("failed", "The enhancement service ran into a problem. Please try again.");
  }
  const submitted = (await res.json().catch(() => ({}))) as { id?: string; polling_url?: string; cost?: number | null };
  if (!submitted.id || !submitted.polling_url) throw new EnhanceError("failed", "The enhancement service ran into a problem. Please try again.");
  // BFL reports the cost in credits ($0.01 each) when the job is accepted.
  const costMicros = typeof submitted.cost === "number" && Number.isFinite(submitted.cost) ? Math.round(submitted.cost * 10_000) : null;

  while (Date.now() - startedAt < TOTAL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    const poll = await fetchWithTimeout(submitted.polling_url, { headers: { accept: "application/json", "x-key": apiKey } }, SUBMIT_TIMEOUT_MS);
    if (!poll.ok) {
      if (poll.status === 429) continue;
      throw new EnhanceError("failed", "The enhancement service ran into a problem. Please try again.");
    }
    const data = (await poll.json().catch(() => ({}))) as { status?: string; result?: { sample?: string } };
    if (data.status === "Ready") {
      if (!data.result?.sample) throw new EnhanceError("failed", "The enhancement service didn't return a picture.");
      // The result link is temporary: download it right away.
      const img = await fetchWithTimeout(data.result.sample, {}, SUBMIT_TIMEOUT_MS);
      if (!img.ok) throw new EnhanceError("failed", "Couldn't download the enhanced picture. Please try again.");
      return { bytes: new Uint8Array(await img.arrayBuffer()), type: img.headers.get("content-type") ?? "image/jpeg", costMicros };
    }
    if (data.status && /moderated/i.test(data.status)) throw new EnhanceError("declined", "The enhancement service declined this picture.");
    if (data.status && /error|failed|not found/i.test(data.status)) throw new EnhanceError("failed", "The enhancement service ran into a problem. Please try again.");
    // Pending and other in-progress states: keep waiting.
  }
  throw new EnhanceError("failed", "The enhancement service took too long. Please try again.");
}

/**
 * The tidied version of one picture: the kept copy when this exact picture was enhanced before, otherwise one new
 * FLUX 3 call (kept right away, so it's never paid for twice even if the page is closed).
 */
export async function enhancePicture(userId: string, source: { bytes: Uint8Array; type: string }, mode: EnhanceMode = "tidy"): Promise<EnhanceResult> {
  if (source.bytes.length > MAX_SOURCE_BYTES) throw new EnhanceError("too_large", "This picture is too large to enhance.");
  // Practice copies are kept apart, so a real enhancement is never skipped because of a practice one.
  const key = enhanceKey(userId, source.bytes, mode) + (practiceMode() ? "-practice" : "");
  const kept = await env.UPLOADS.get(key).catch(() => null);
  if (kept) {
    const type = kept.httpMetadata?.contentType ?? "image/jpeg";
    return { imageDataUrl: toDataUrl(new Uint8Array(await kept.arrayBuffer()), type), practice: kept.customMetadata?.practice === "1", reused: true, costMicros: null };
  }
  if (practiceMode()) {
    await env.UPLOADS.put(key, source.bytes, { httpMetadata: { contentType: source.type }, customMetadata: { practice: "1" } });
    return { imageDataUrl: toDataUrl(source.bytes, source.type), practice: true, reused: false, costMicros: null };
  }
  const made = await runFlux3(source.bytes, mode === "flat" ? FLAT_PROMPT : ENHANCE_PROMPT);
  await env.UPLOADS.put(key, made.bytes, { httpMetadata: { contentType: made.type }, customMetadata: { version: mode === "flat" ? FLAT_VERSION : ENHANCE_VERSION } });
  return { imageDataUrl: toDataUrl(made.bytes, made.type), practice: false, reused: false, costMicros: made.costMicros };
}

/** Forgets every kept enhancement copy (account deleted). */
export async function deleteEnhanceCopies(userId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await env.UPLOADS.list({ prefix: `private/enhance/${userId}/`, cursor });
    if (page.objects.length) await env.UPLOADS.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

/**
 * Saves the enhanced picture a piece will show (after the device's background removal), next to its own pictures.
 * Named like a cut-out so the closet lays it out the same way; it notes the true original photo, like cut-outs do.
 */
export async function saveEnhanced(originalUrl: string, file: File): Promise<string> {
  if (file.type !== "image/png" || file.size === 0 || file.size > 8 * 1024 * 1024) throw new Error("bad picture");
  const key = `cut-enh-${crypto.randomUUID()}.png`;
  await env.UPLOADS.put(key, new Uint8Array(await file.arrayBuffer()), {
    httpMetadata: { contentType: "image/png" },
    customMetadata: { original: originalUrl, enhanced: ENHANCE_VERSION },
  });
  return `/uploads/${key}`;
}
