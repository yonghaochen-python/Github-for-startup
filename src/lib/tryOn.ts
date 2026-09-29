import type { LayeringRole } from "@/lib/layering";

export type TryOnItem = { imageUrl: string; description: string; layeringRole: LayeringRole };
export type TryOnLayer = { role: LayeringRole; items: TryOnItem[] };

export type TryOnResult = {
  isMock: boolean;
  selfieUrl: string;
  layers: TryOnLayer[];
};

/**
 * Placeholder implementation. Claude does text and vision, not image generation, so
 * there's no real "you wearing this outfit" composite yet. This receives the
 * complete layered outfit (outer-to-accessory order, matching how it's displayed
 * elsewhere) and returns it alongside the selfie for a mock preview client-side.
 * Swap this function's body for a real image-generation API call later — the
 * layers array is already the shape such an API would need (ordered, grouped by
 * role) to composite each layer onto the selfie correctly; nothing else changes.
 */
export async function generateTryOnPreview(selfieUrl: string, layers: TryOnLayer[]): Promise<TryOnResult> {
  return { isMock: true, selfieUrl, layers };
}
