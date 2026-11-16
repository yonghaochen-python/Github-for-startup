import { prisma } from "@/lib/prisma";
import { colorOfWords, distance } from "@/lib/colorMatch";
import type { TryPostPiece } from "@/lib/postRules";

/**
 * "Recreate with My Closet": for each piece in a post, the closest piece in the viewer's own closet (same kind, then the
 * nearest color, shared words like "puffer" or "pleated", same brand). Plain matching on what's already stored: no AI,
 * no cost. Which closet piece the poster used is never shown; only the viewer's own pieces come back.
 */

const STOP = new Set(["the", "and", "with", "a", "an", "of", "in", "on", "for", "my", "piece", "style", "look"]);
const COLOR_WORD = /^(off|white|ivory|cream|black|charcoal|gray|grey|silver|navy|light|dark|sky|denim|teal|turquoise|blue|sage|olive|mint|emerald|forest|khaki|green|mustard|yellow|gold|camel|tan|beige|taupe|chocolate|brown|rust|terracotta|orange|coral|peach|burgundy|wine|maroon|red|blush|fuchsia|pink|rose|lavender|lilac|plum|purple)$/;
const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .map((w) => w.replace(/s$/, ""))
      .filter((w) => w.length > 2 && !STOP.has(w) && !COLOR_WORD.test(w))
  );

/** Where a post piece is worn, from its kind and name (a sweater goes over a tee; a cardigan under a coat). */
export function roleOf(category: string | null, name: string): string {
  const n = name.toLowerCase();
  if (category === "outerwear") return /cardigan|vest|gilet/.test(n) ? "mid_layer" : "outer_layer";
  if (category === "top") return /sweater|hoodie|sweatshirt|cardigan|knit|pullover|jumper|fleece/.test(n) ? "mid_layer" : "base_layer";
  if (category === "dress") return "one_piece";
  if (category === "bottom" || category === "shoes") return category;
  return "accessory";
}

type Candidate = { id: string; imageUrl: string; category: string; layeringRole: string; color: string; description: string; brand: string | null };

function score(item: { name: string; brand: string | null; role: string }, c: Candidate): number {
  let s = c.layeringRole === item.role ? 2 : 0;
  const a = colorOfWords(item.name);
  const b = colorOfWords(c.color) ?? colorOfWords(c.description);
  if (a && b) s += Math.max(-2, 4 * (1 - distance(a, b) / 0.3));
  const theirs = words(item.name);
  let shared = 0;
  for (const w of words(`${c.description} ${c.color}`)) if (theirs.has(w)) shared++;
  s += Math.min(3, shared) * 1.5;
  if (item.brand && c.brand && item.brand.toLowerCase() === c.brand.toLowerCase()) s += 2;
  return s;
}

/** The post's pieces, each with the viewer's closest closet piece (or none). Null when the post isn't visible. */
export async function matchPost(postId: string, viewer: { id: string; role: string }): Promise<TryPostPiece[] | null> {
  const post = await prisma.post.findFirst({
    where: { id: postId },
    select: {
      userId: true,
      status: true,
      items: {
        orderBy: { position: "asc" },
        select: { name: true, category: true, brand: true, detailsPrivate: true, imageKey: true, closetItemId: true, closetItem: { select: { userId: true, layeringRole: true } } },
      },
    },
  });
  if (!post || post.status === "removed") return null;
  if (post.status !== "published" && post.userId !== viewer.id && viewer.role !== "admin") return null;

  const closet: Candidate[] = await prisma.clothingItem.findMany({
    where: { userId: viewer.id },
    select: { id: true, imageUrl: true, category: true, layeringRole: true, color: true, description: true, brand: true },
  });
  const used = new Set<string>();
  return post.items.map((it) => {
    // The poster's own role for the piece when it came from their closet (kept private; only the role is used).
    const role = it.closetItem?.layeringRole ?? roleOf(it.category, it.name);
    // An "only me" brand is only used for the person who posted it.
    const item = { name: it.name, brand: it.detailsPrivate && post.userId !== viewer.id ? null : it.brand, role };
    // Trying their own post: their exact piece.
    const own = it.closetItemId && it.closetItem?.userId === viewer.id ? closet.find((c) => c.id === it.closetItemId) : undefined;
    let best: { c: Candidate; s: number } | null = own ? { c: own, s: 99 } : null;
    if (!best && it.category) {
      for (const c of closet) {
        if (used.has(c.id) || c.category !== it.category) continue;
        const s = score(item, c);
        if (!best || s > best.s) best = { c, s };
      }
    }
    if (best) used.add(best.c.id);
    return {
      name: it.name,
      category: it.category,
      role,
      theirs: it.imageKey ? `/uploads/${it.imageKey}` : null,
      mine: best ? { id: best.c.id, imageUrl: best.c.imageUrl, description: best.c.description, close: best.s >= 4 } : null,
    };
  });
}
