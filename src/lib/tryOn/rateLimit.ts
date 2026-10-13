const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

/**
 * Best-effort cap on how many real (paid) try-ons one person can start per hour. Held in memory per server
 * instance, so it's an approximate guard rather than a hard guarantee. The mock provider never counts.
 */
export function takeTryOnSlot(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return false;
  }
  recent.push(now);
  hits.set(userId, recent);
  return true;
}
