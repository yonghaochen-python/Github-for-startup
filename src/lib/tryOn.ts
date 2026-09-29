export type TryOnItem = { imageUrl: string; description: string };

export type TryOnResult = {
  isMock: boolean;
  selfieUrl: string;
  items: TryOnItem[];
};

/**
 * Placeholder implementation. Claude does text and vision, not image generation, so
 * there's no real "you wearing this outfit" composite yet. This returns the pieces
 * needed to render a mock preview client-side (the selfie plus the outfit's item
 * photos). Swap this function's body for a real image-generation API call later —
 * the signature and return shape are the integration point; nothing else needs to
 * change.
 */
export async function generateTryOnPreview(selfieUrl: string, items: TryOnItem[]): Promise<TryOnResult> {
  return { isMock: true, selfieUrl, items };
}
