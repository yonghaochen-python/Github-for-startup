/**
 * A page's fetch that rides through a short hiccup: a failed connection or a server error (5xx) is tried again after
 * a moment, twice, before the page shows an error. "Not signed in" and other answers come back straight away.
 */
const WAITS_MS = [800, 2000];

export async function fetchWithRetry(input: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.status < 500 || attempt >= WAITS_MS.length) return res;
    } catch (err) {
      if (attempt >= WAITS_MS.length) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, WAITS_MS[attempt]));
  }
}
