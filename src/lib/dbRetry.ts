/**
 * D1 (SQLite under the hood) can fail a read for a moment: right after a write to the same table, or during a short
 * Cloudflare database hiccup (seen live as every signed-in page failing for a minute). Try up to three times, waiting
 * a little longer each time, before giving up.
 */
const WAITS_MS = [200, 700];

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= WAITS_MS.length) throw err;
      console.error(`DB read failed (attempt ${attempt + 1}), retrying:`, err instanceof Error ? err.message : err);
      await new Promise((resolve) => setTimeout(resolve, WAITS_MS[attempt]));
    }
  }
}
