import type { LayeringRole } from "@/lib/layering";

export type TryOnItemInfo = { id: string; imageUrl: string; description: string; layeringRole: LayeringRole };
export type TryOnLayer = { role: LayeringRole; items: TryOnItemInfo[] };

export type ImageBytes = { bytes: Uint8Array; mediaType: string };

/** An outfit piece plus a lazy way to get its photo, so providers that don't need images (the mock) never load them. */
export type TryOnInputItem = TryOnItemInfo & { getImage: () => Promise<ImageBytes> };
export type TryOnInputLayer = { role: LayeringRole; items: TryOnInputItem[] };

export type TryOnInput = {
  /** The person's photo. Held in memory for this one request only — never stored. */
  person: ImageBytes;
  /** The outfit's real closet items, grouped by layer, outermost first. Providers must not add clothing. */
  layers: TryOnInputLayer[];
};

/** A piece the provider could not show in the generated image, with a plain-language reason. */
export type TryOnNote = { role: LayeringRole; description: string; reason: string };

export type TryOnResult = {
  /** True when no real AI generation happened (prototype). The UI labels the result accordingly. */
  isMock: boolean;
  provider: string;
  /** The generated image as a data URL, or null when the provider produced none (mock). */
  imageDataUrl: string | null;
  layers: TryOnLayer[];
  /** Pieces in the outfit that this provider did not render (e.g. shoes), so the UI can say so honestly. */
  notShown?: TryOnNote[];
};

export type TryOnErrorCode = "not_configured" | "quota_exhausted" | "rate_limited" | "provider_error";

/** A failure whose message is safe to show the person. */
export class TryOnError extends Error {
  constructor(
    public code: TryOnErrorCode,
    message: string
  ) {
    super(message);
  }
}

/**
 * The replaceable generation layer. A real virtual try-on service is added by implementing this
 * interface and registering it in ./index.ts; neither the API route nor the page knows which
 * provider is in use.
 */
export interface TryOnProvider {
  name: string;
  generate(input: TryOnInput): Promise<TryOnResult>;
}

/** Drops the image loaders so layers can be returned to the browser as plain JSON. */
export function toPlainLayers(layers: TryOnInputLayer[]): TryOnLayer[] {
  return layers.map((layer) => ({
    role: layer.role,
    items: layer.items.map(({ id, imageUrl, description, layeringRole }) => ({ id, imageUrl, description, layeringRole })),
  }));
}
