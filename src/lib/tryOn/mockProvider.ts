import { toPlainLayers, type TryOnProvider } from "./types";

/**
 * Prototype provider: performs no AI generation. It returns the outfit's real layers and no image, so
 * the page shows the person's own photo next to the outfit pieces and labels it as a prototype.
 * Replace by registering a real provider in ./index.ts.
 */
export const mockTryOnProvider: TryOnProvider = {
  name: "mock",
  async generate({ layers }) {
    return { isMock: true, provider: "mock", imageDataUrl: null, layers: toPlainLayers(layers) };
  },
};
