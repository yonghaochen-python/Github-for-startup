import { falFluxVtoProvider } from "./providers/falFluxVto";
import { mockTryOnProvider } from "./mockProvider";
import { takeTryOnSlot } from "./rateLimit";
import { TryOnError, type TryOnInput, type TryOnProvider, type TryOnResult } from "./types";

export { TryOnError } from "./types";
export type { TryOnInput, TryOnInputItem, TryOnInputLayer, TryOnItemInfo, TryOnLayer, TryOnProvider, TryOnResult, TryOnNote } from "./types";

/** Real providers, keyed by the value of the TRYON_PROVIDER setting. The mock is the default. */
function getTryOnProvider(): TryOnProvider {
  const name = process.env.TRYON_PROVIDER ?? "mock";
  if (name === "mock") return mockTryOnProvider;

  if (name === "fal-flux-vto") {
    const key = process.env.FAL_KEY;
    if (!key) {
      throw new TryOnError("not_configured", "Try It On isn't connected yet. (Its service key isn't set up.)");
    }
    return falFluxVtoProvider(key);
  }

  console.warn(`Unknown TRYON_PROVIDER "${name}"; falling back to the mock prototype.`);
  return mockTryOnProvider;
}

/**
 * The single entry point the API route uses. Picks the configured provider and, for real (paid) providers,
 * applies a per-user hourly cap so one person can't burn through the credits.
 */
export async function runTryOn(input: TryOnInput, userId: string): Promise<TryOnResult> {
  const provider = getTryOnProvider();
  if (provider.name !== "mock" && !takeTryOnSlot(userId)) {
    throw new TryOnError("rate_limited", "You've run a lot of try-ons in the last hour. Please try again a little later.");
  }
  return provider.generate(input);
}
