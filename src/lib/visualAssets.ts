import type { LayeringRole } from "@/lib/layering";

/**
 * Visual-asset processing for the closet, kept in one place so each stage can be
 * swapped for a real service later without touching call sites.
 */

/**
 * MOCKED — identity passthrough. Real background removal (a segmentation/matting
 * API, e.g. remove.bg or a self-hosted model) isn't connected yet. This is the
 * single, obvious place to wire one in: it's already called right after every
 * upload (single-item and multi-item), so swapping the body of this function for
 * a real API call requires no changes anywhere else. The "isolated on a clean
 * background" look users see today comes from the card styling (item photos
 * framed on white/neutral, not from actual pixel-level cutout).
 */
export async function removeBackground(imageUrl: string): Promise<string> {
  return imageUrl;
}

export type BoardLayerVisual<Item> = {
  role: LayeringRole;
  items: Item[];
};

export type OutfitBoard<Item> = {
  isMock: boolean;
  layers: BoardLayerVisual<Item>[];
};

/**
 * MOCKED — assembles the outfit's real closet-item photos into the ordered layer
 * list the Outfit Board renders as a CSS cascade (see OutfitBoardView). This does
 * NOT generate a new composite image; every photo shown is the user's own. A real
 * image-generation/compositing API would replace this function's body with a call
 * that returns one composed image URL instead of a layer list — the caller would
 * then render that single image instead of the stacked-card visual.
 */
export async function generateOutfitBoard<Item>(layers: BoardLayerVisual<Item>[]): Promise<OutfitBoard<Item>> {
  return { isMock: true, layers };
}
