import type { LayeringRole } from "@/lib/layering";
import {
  TryOnError,
  toPlainLayers,
  type ImageBytes,
  type TryOnInputItem,
  type TryOnNote,
  type TryOnProvider,
} from "../types";

/**
 * Black Forest Labs' FLUX virtual try-on, hosted on fal.ai (model "fal-ai/flux-pro/v1/vto").
 *
 * The model dresses one garment per call, so a layered outfit is built one piece at a time, innermost first
 * (bottom -> base layer -> mid layer -> outer layer), feeding each result in as the next call's person photo.
 * It only handles clothing, so shoes and accessories are left out and reported back as "not shown".
 *
 * Privacy: everything is sent inline (no files are uploaded to fal) and `sync_mode` is on, which returns the
 * image directly and keeps it out of fal's request history. Only the inputs of the single request are used;
 * nothing is stored on our side.
 */

const MODEL = "fal-ai/flux-pro/v1/vto";
const CALL_TIMEOUT_MS = 120_000;

/** Innermost to outermost. A one-piece (dress/jumpsuit) replaces the bottom + base, so it goes first. */
const WORN_ORDER: LayeringRole[] = ["one_piece", "bottom", "base_layer", "mid_layer", "outer_layer"];

const KEEP_SAME = "Keep the person's face, body, pose, and the background exactly the same.";

function promptFor(role: LayeringRole, description: string): string {
  const garment = description.trim() || "garment";
  switch (role) {
    case "one_piece":
      return `A natural, front-facing full-length photo of the same person now wearing the ${garment}. ${KEEP_SAME}`;
    case "bottom":
      return `A natural, front-facing full-length photo of the same person now wearing the ${garment} on the lower body. ${KEEP_SAME}`;
    case "base_layer":
      return `A natural, front-facing full-length photo of the same person now wearing the ${garment} as the inner top, tucked in naturally. ${KEEP_SAME}`;
    case "mid_layer":
      return `A natural, front-facing full-length photo of the same person now wearing the ${garment} layered over the top they already have on, so the inner top stays visible at the collar and hem. ${KEEP_SAME}`;
    case "outer_layer":
      return `A natural, front-facing full-length photo of the same person now wearing the ${garment} as an open outer layer over the clothes they already have on, so those clothes stay visible underneath. ${KEEP_SAME}`;
    default:
      return `A natural, front-facing full-length photo of the same person now wearing the ${garment}. ${KEEP_SAME}`;
  }
}

const toDataUri = ({ bytes, mediaType }: ImageBytes) => `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`;

type FalResponse = { images?: { url?: string }[]; detail?: unknown };

function messageFromDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail ?? "");
  } catch {
    return "";
  }
}

async function callFal(baseUrl: string, apiKey: string, body: Record<string, unknown>): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/${MODEL}`, {
      method: "POST",
      headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new TryOnError("provider_error", "The try-on service took too long to respond. Please try again.");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as FalResponse;
    const detail = messageFromDetail(payload.detail).toLowerCase();
    if (res.status === 402 || detail.includes("balance") || detail.includes("exhausted") || detail.includes("credit")) {
      throw new TryOnError(
        "quota_exhausted",
        "Try It On is paused because its testing credits have run out. Please try again later."
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new TryOnError("not_configured", "Try It On isn't connected correctly yet (the service key was rejected).");
    }
    if (res.status === 429) {
      throw new TryOnError("rate_limited", "The try-on service is busy right now. Please try again in a minute.");
    }
    if (res.status === 422) {
      throw new TryOnError(
        "provider_error",
        "The try-on service couldn't use one of the photos. Try a clearer, full-body photo of you."
      );
    }
    throw new TryOnError("provider_error", "The try-on service ran into a problem. Please try again.");
  }

  const data = (await res.json().catch(() => ({}))) as FalResponse;
  const url = data.images?.[0]?.url;
  if (!url) throw new TryOnError("provider_error", "The try-on service didn't return an image. Please try again.");
  return url;
}

/** The result image as a data URL (sync_mode already gives one; otherwise fetch it). */
async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  if (!res.ok) throw new TryOnError("provider_error", "Couldn't download the try-on result. Please try again.");
  const type = res.headers.get("content-type") ?? "image/jpeg";
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

export function falFluxVtoProvider(apiKey: string): TryOnProvider {
  const baseUrl = (process.env.FAL_BASE_URL ?? "https://fal.run").replace(/\/$/, "");

  return {
    name: "fal-flux-vto",
    async generate({ person, layers }) {
      const steps: { role: LayeringRole; item: TryOnInputItem }[] = [];
      for (const role of WORN_ORDER) {
        for (const layer of layers) {
          if (layer.role !== role) continue;
          for (const item of layer.items) steps.push({ role, item });
        }
      }

      const notShown: TryOnNote[] = layers
        .filter((l) => !WORN_ORDER.includes(l.role))
        .flatMap((l) =>
          l.items.map((item) => ({
            role: l.role,
            description: item.description,
            reason: "Shoes and accessories aren't shown in this try-on yet.",
          }))
        );

      if (steps.length === 0) {
        throw new TryOnError(
          "provider_error",
          "This outfit has no clothing pieces this try-on can show yet. It shows tops, bottoms, layers, and dresses."
        );
      }

      let current = toDataUri(person);
      for (const { role, item } of steps) {
        const garment = await item.getImage();
        current = await callFal(baseUrl, apiKey, {
          prompt: promptFor(role, item.description),
          human_image_url: current,
          garment_image_url: toDataUri(garment),
          sync_mode: true,
          output_format: "jpeg",
        });
      }

      return {
        isMock: false,
        provider: "fal-flux-vto",
        imageDataUrl: await toDataUrl(current),
        layers: toPlainLayers(layers),
        ...(notShown.length > 0 && { notShown }),
      };
    },
  };
}
