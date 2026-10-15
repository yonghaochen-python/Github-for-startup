import type { LayeringRole } from "@/lib/layering";
import { TryOnError, toPlainLayers, type ImageBytes, type TryOnInputItem, type TryOnProvider } from "../types";

/**
 * Black Forest Labs' FLUX virtual try-on, called directly on the BFL API (model "vto-v2").
 *
 * The whole outfit is sent as one garment reference: the browser lays every piece out on a single canvas
 * (`garmentSheet`), which BFL recommends for multi-garment looks. That makes a full outfit one paid call,
 * and shoes and accessories can be shown too. If no sheet arrives, the outfit falls back to one call per
 * piece, innermost first, feeding each result into the next call.
 *
 * Privacy: the photo and garments are sent inline as base64 (nothing is uploaded elsewhere first). BFL
 * returns a signed result URL that expires after 10 minutes; we download it right away and return it as a
 * data URL. Nothing is stored on our side.
 */

const MODEL_PATH = "/v1/flux-tools/vto-v2";
const SUBMIT_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

/** Innermost to outermost, then feet and accessories. */
const WORN_ORDER: LayeringRole[] = ["one_piece", "bottom", "base_layer", "mid_layer", "outer_layer", "shoes", "accessory"];

const PREFIX = "The person of image 1, maintaining exactly their face and pose, wearing";

/** One garment phrase per piece, phrased so layered tops stack the right way round. */
function phraseFor(role: LayeringRole, description: string): string {
  const garment = `the ${description.trim() || "garment"}`;
  switch (role) {
    case "base_layer":
      return `${garment} as the inner top`;
    case "mid_layer":
      return `${garment} layered over the inner top`;
    case "outer_layer":
      return `${garment} worn open as the outer layer`;
    default:
      return garment;
  }
}

function joinPhrases(phrases: string[]): string {
  if (phrases.length <= 1) return phrases[0] ?? "the garments";
  return `${phrases.slice(0, -1).join(", ")}, and ${phrases[phrases.length - 1]}`;
}

const toBase64 = ({ bytes }: ImageBytes) => Buffer.from(bytes).toString("base64");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SubmitResponse = { id?: string; polling_url?: string; detail?: unknown };
type PollResponse = { status?: string; result?: { sample?: string }; details?: unknown };

function detailText(detail: unknown): string {
  if (typeof detail === "string") return detail.toLowerCase();
  try {
    return JSON.stringify(detail ?? "").toLowerCase();
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new TryOnError("provider_error", "The try-on service took too long to respond. Please try again.");
  } finally {
    clearTimeout(timer);
  }
}

/** Submits one try-on job and waits for it. Returns the signed result URL. */
async function runJob(baseUrl: string, apiKey: string, body: Record<string, unknown>): Promise<string> {
  const startedAt = Date.now();
  const res = await fetchWithTimeout(
    `${baseUrl}${MODEL_PATH}`,
    {
      method: "POST",
      headers: { accept: "application/json", "Content-Type": "application/json", "x-key": apiKey },
      body: JSON.stringify(body),
    },
    SUBMIT_TIMEOUT_MS
  );

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as SubmitResponse;
    const detail = detailText(payload.detail);
    if (res.status === 402 || detail.includes("credit") || detail.includes("insufficient")) {
      throw new TryOnError("quota_exhausted", "Try It On is paused because its credits have run out. Please try again later.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new TryOnError("not_configured", "Try It On isn't connected correctly yet (the service key was rejected).");
    }
    if (res.status === 429) {
      throw new TryOnError("rate_limited", "The try-on service is busy right now. Please try again in a minute.");
    }
    if (res.status === 422 || res.status === 400) {
      throw new TryOnError("provider_error", "The try-on service couldn't use one of the photos. Try a clearer, full-body photo of you.");
    }
    throw new TryOnError("provider_error", "The try-on service ran into a problem. Please try again.");
  }

  const submitted = (await res.json().catch(() => ({}))) as SubmitResponse;
  if (!submitted.id) throw new TryOnError("provider_error", "The try-on service ran into a problem. Please try again.");
  // Always poll the URL BFL returns: it points at the region that took the job.
  const pollUrl = submitted.polling_url ?? `${baseUrl}/v1/get_result?id=${encodeURIComponent(submitted.id)}`;

  while (Date.now() - startedAt < TOTAL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    const poll = await fetchWithTimeout(pollUrl, { headers: { accept: "application/json", "x-key": apiKey } }, SUBMIT_TIMEOUT_MS);
    if (!poll.ok) {
      if (poll.status === 429) continue;
      throw new TryOnError("provider_error", "The try-on service ran into a problem. Please try again.");
    }
    const data = (await poll.json().catch(() => ({}))) as PollResponse;
    switch (data.status) {
      case "Ready":
        if (!data.result?.sample) break;
        return data.result.sample;
      case "Request Moderated":
      case "Content Moderated":
        throw new TryOnError(
          "provider_error",
          "The try-on service declined this photo. Try a different photo of you, fully clothed and facing the camera."
        );
      case "Error":
      case "Task not found":
        throw new TryOnError("provider_error", "The try-on service ran into a problem. Please try again.");
      default:
        continue; // "Pending" and other in-progress states
    }
    throw new TryOnError("provider_error", "The try-on service didn't return an image. Please try again.");
  }
  throw new TryOnError("provider_error", "The try-on service took too long to respond. Please try again.");
}

/** Downloads the signed result (valid for 10 minutes) into a data URL. */
async function toDataUrl(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, {}, SUBMIT_TIMEOUT_MS);
  if (!res.ok) throw new TryOnError("provider_error", "Couldn't download the try-on result. Please try again.");
  const type = res.headers.get("content-type") ?? "image/jpeg";
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

export function bflFluxVtoProvider(apiKey: string): TryOnProvider {
  const baseUrl = (process.env.BFL_BASE_URL ?? "https://api.bfl.ai").replace(/\/$/, "");

  return {
    name: "bfl-flux-vto",
    async generate({ person, layers, garmentSheet }) {
      const steps: { role: LayeringRole; item: TryOnInputItem }[] = [];
      for (const role of WORN_ORDER) {
        for (const layer of layers) {
          if (layer.role !== role) continue;
          for (const item of layer.items) steps.push({ role, item });
        }
      }
      if (steps.length === 0) {
        throw new TryOnError("provider_error", "This outfit has no pieces to try on.");
      }

      let sampleUrl: string;
      if (garmentSheet || steps.length === 1) {
        // One call for the whole look: every piece is on the sheet (or there is only one piece).
        const garment = garmentSheet ?? (await steps[0].item.getImage());
        const prompt = `${PREFIX} ${joinPhrases(steps.map((s) => phraseFor(s.role, s.item.description)))} of image 2.`;
        sampleUrl = await runJob(baseUrl, apiKey, {
          prompt,
          person: toBase64(person),
          garment: toBase64(garment),
          output_format: "jpeg",
        });
      } else {
        // No sheet: dress one piece per call, feeding each result into the next.
        let current = toBase64(person);
        sampleUrl = "";
        for (const { role, item } of steps) {
          const garment = await item.getImage();
          sampleUrl = await runJob(baseUrl, apiKey, {
            prompt: `${PREFIX} ${phraseFor(role, item.description)} of image 2, keeping everything else they have on.`,
            person: current,
            garment: toBase64(garment),
            output_format: "jpeg",
          });
          current = sampleUrl;
        }
      }

      return {
        isMock: false,
        provider: "bfl-flux-vto",
        imageDataUrl: await toDataUrl(sampleUrl),
        layers: toPlainLayers(layers),
      };
    },
  };
}
