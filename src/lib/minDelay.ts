/**
 * Ensures a loading state stays visible for at least `ms` from when loading
 * started, even if the underlying fetch resolves almost instantly — without
 * this, fast local/cached responses make the branded LoadingScreen flash too
 * quickly to register as anything other than a one-time boot screen.
 */
export function afterMinDelay(startedAt: number, ms: number, fn: () => void): void {
  const remaining = ms - (Date.now() - startedAt);
  if (remaining <= 0) fn();
  else setTimeout(fn, remaining);
}
