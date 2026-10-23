/**
 * "Try on from any store": reads a product page's openly published details (its preview image, title, store name and,
 * when the page states it, price) so the piece can be tried on. Only what the page publishes is returned; nothing
 * is guessed. Stores that refuse automated access are respected, not worked around.
 *
 * Safety (server-side request forgery): only http/https on the normal ports, no logins in the link, no private,
 * loopback, link-local or internal addresses — checked for the link and again for every redirect (followed by hand,
 * at most MAX_REDIRECTS), with the host's addresses looked up first. Short timeouts and size limits throughout.
 * Nothing fetched is stored.
 */

const MAX_REDIRECTS = 3;
const PAGE_TIMEOUT_MS = 8000;
const PAGE_MAX_BYTES = 2_000_000;
const IMAGE_MAX_BYTES = 5_000_000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
// An honest name, so stores can recognise (and refuse) Virm if they choose.
const USER_AGENT = "Mozilla/5.0 (compatible; VirmProductPreview/1.0; +https://virm-virtualmirror.pages.dev)";

export class ImportError extends Error {
  constructor(
    public reason: "invalid" | "blocked" | "unreachable" | "no-image" | "too-large",
    message: string
  ) {
    super(message);
  }
}

export type ImportedProduct = {
  productUrl: string;
  retailer: string;
  name: string | null;
  price: string | null;
  currency: string | null;
  imageDataUrl: string;
};

/* ---------- Addresses ---------- */

function ipv4Private(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipv6Private(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::" || v === "::1") return true;
  const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}

const isIpv4 = (h: string) => /^\d+\.\d+\.\d+\.\d+$/.test(h);
const isIpv6 = (h: string) => h.includes(":");

/** Checks a link's shape: http/https, normal ports, no logins, not a local or internal name. */
export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ImportError("invalid", "That doesn't look like a web link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ImportError("invalid", "Use a link that starts with https://");
  if (url.username || url.password) throw new ImportError("invalid", "Links with logins in them aren't supported.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new ImportError("invalid", "That link uses an unusual port.");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || /(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(host)) {
    throw new ImportError("invalid", "That link isn't a public store page.");
  }
  if ((isIpv4(host) && ipv4Private(host)) || (isIpv6(host) && ipv6Private(host))) {
    throw new ImportError("invalid", "That link isn't a public store page.");
  }
  return url;
}

/** Looks up the host's addresses (public DNS over HTTPS) and refuses any private or internal one. */
async function checkHostAddresses(host: string): Promise<void> {
  if (isIpv4(host) || isIpv6(host)) return; // Already checked as a literal address.
  const found: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
    if (!res?.ok) continue;
    const data = (await res.json().catch(() => ({}))) as { Answer?: { type: number; data: string }[] };
    for (const a of data.Answer ?? []) if (a.type === 1 || a.type === 28) found.push(a.data);
  }
  if (found.length === 0) throw new ImportError("unreachable", "Couldn't find that website.");
  if (found.some((ip) => (isIpv4(ip) ? ipv4Private(ip) : ipv6Private(ip)))) {
    throw new ImportError("invalid", "That link isn't a public store page.");
  }
}

/* ---------- Fetching ---------- */

/** Reads at most `max` bytes of a response, failing if it's bigger. */
async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > max) throw new ImportError("too-large", "That file is too large.");
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      throw new ImportError("too-large", "That file is too large.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** Fetches a public URL safely: every hop is checked, redirects are followed by hand, with a timeout and size cap. */
async function safeFetch(start: URL, accept: string, max: number): Promise<{ url: URL; type: string; body: Uint8Array }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    url = checkUrl(url.toString());
    await checkHostAddresses(url.hostname);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, accept },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
    } catch {
      throw new ImportError("unreachable", "That store didn't respond in time.");
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new ImportError("unreachable", "That page couldn't be opened.");
      url = new URL(location, url);
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 451) {
      throw new ImportError("blocked", "This store doesn't let apps read its pages. Upload a photo of the item instead.");
    }
    if (!res.ok) throw new ImportError("unreachable", "That page couldn't be opened.");
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    return { url, type, body: await readCapped(res, max) };
  }
  throw new ImportError("unreachable", "That link redirects too many times.");
}

/* ---------- Reading the page ---------- */

function decode(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key.replace(/[.:]/g, "\\$&")}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decode(content);
  }
  return null;
}

type JsonLdProduct = { name?: string; image?: unknown; brand?: unknown; offers?: unknown };

/** The first schema.org Product the page publishes in JSON-LD, if any. */
function jsonLdProduct(html: string): JsonLdProduct | null {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const nodes: unknown[] = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const node of nodes) {
        const t = (node as { "@type"?: unknown })?.["@type"];
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) return node as JsonLdProduct;
      }
    } catch {}
  }
  return null;
}

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? decode(v) : typeof v === "number" ? String(v) : null);

/** Imports a product from its page link: its details and its main image (as a data URL; nothing is stored). */
export async function importProduct(rawUrl: string): Promise<ImportedProduct> {
  const page = await safeFetch(checkUrl(rawUrl), "text/html,application/xhtml+xml", PAGE_MAX_BYTES);
  if (!page.type.includes("html")) throw new ImportError("no-image", "That link isn't a product page.");
  const html = new TextDecoder().decode(page.body);

  const product = jsonLdProduct(html);
  const offer = first(product?.offers) as { price?: unknown; priceCurrency?: unknown; lowPrice?: unknown } | undefined;
  const imageRef =
    metaContent(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) ??
    asText(first(product?.image)) ??
    asText((first(product?.image) as { url?: unknown } | undefined)?.url);
  if (!imageRef) throw new ImportError("no-image", "Couldn't find the item's picture on that page. Upload a photo of it instead.");

  const image = await safeFetch(new URL(imageRef, page.url), IMAGE_TYPES.join(","), IMAGE_MAX_BYTES).catch((err) => {
    throw err instanceof ImportError && err.reason === "blocked"
      ? new ImportError("blocked", "This store doesn't let apps load its pictures. Upload a photo of the item instead.")
      : err;
  });
  if (!IMAGE_TYPES.includes(image.type)) throw new ImportError("no-image", "The item's picture couldn't be read. Upload a photo of it instead.");

  const brand = first(product?.brand);
  return {
    productUrl: page.url.toString(),
    retailer:
      metaContent(html, ["og:site_name"]) ?? asText((brand as { name?: unknown } | undefined)?.name) ?? page.url.hostname.replace(/^www\./, ""),
    name: asText(product?.name) ?? metaContent(html, ["og:title", "twitter:title"]),
    price: asText(offer?.price ?? offer?.lowPrice) ?? metaContent(html, ["product:price:amount", "og:price:amount"]),
    currency: asText(offer?.priceCurrency) ?? metaContent(html, ["product:price:currency", "og:price:currency"]),
    imageDataUrl: `data:${image.type};base64,${Buffer.from(image.body).toString("base64")}`,
  };
}
