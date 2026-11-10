/**
 * The photo try-on's instruction for a whole outfit, and the one order its pieces are laid out in. Shared by the
 * browser (which lays the pictures out on one garment sheet in this order) and the server (which names them in the
 * same order), so "1) …, 2) …" in the instruction always matches the pictures' places on the sheet.
 *
 * Single-pass try-on tends to drop a second top (an open zip-up over a hoodie, a jacket over a sweater), so the
 * instruction says which picture is which, exactly what goes over what, and that every garment must show.
 */

type Piece = { layeringRole: string; description: string };

/** Innermost to outermost, then feet and accessories. */
const WORN_ORDER = ["one_piece", "bottom", "base_layer", "mid_layer", "outer_layer", "shoes", "accessory"];

/** Pieces that open at the front (worn open over another top): zip-ups, cardigans, jackets, open shirts. */
const OPEN_FRONT = /zip|cardigan|jacket|coat|blazer|shacket|overshirt|button[- ]?(up|down)|kimono|open[- ]front|bomber|parka/i;
const isOpenFront = (p: Piece) => OPEN_FRONT.test(p.description);

/**
 * The order pieces are laid out and named in: innermost first. Two pieces of the same kind keep an open-front one
 * on top (so a zip-up hoodie goes over a pullover, never under it).
 */
export function wornOrder<T extends Piece>(pieces: T[]): T[] {
  return pieces
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const role = WORN_ORDER.indexOf(a.p.layeringRole) - WORN_ORDER.indexOf(b.p.layeringRole);
      if (role) return role;
      const open = Number(isOpenFront(a.p)) - Number(isOpenFront(b.p));
      // Then by name, so the browser and the server always agree on the order (whatever order they started in).
      return open || a.p.description.localeCompare(b.p.description) || a.i - b.i;
    })
    .map(({ p }) => p);
}

const TOP_ROLES = ["one_piece", "base_layer", "mid_layer"];

/**
 * What each piece is in the instruction, in worn order. `name` is how each piece is called ("the gray hoodie").
 * A top over another top, and an outer layer over the tops, say exactly what they go over.
 */
export function wornPhrases(pieces: { role: string; name: string; openFront: boolean }[]): string[] {
  const phrases: string[] = [];
  const tops: string[] = []; // the tops already on, innermost first
  for (const { role, name, openFront } of pieces) {
    const under = tops[tops.length - 1];
    if (role === "base_layer" || role === "mid_layer" || role === "one_piece") {
      if (under && role !== "one_piece") {
        phrases.push(openFront ? `${name} worn open over ${under}, so ${under} stays visible at the front` : `${name} layered over ${under}`);
      } else {
        phrases.push(name);
      }
      tops.push(name);
    } else if (role === "outer_layer") {
      if (under) {
        phrases.push(
          openFront
            ? `${name} worn open and unzipped over ${under}, so ${under} stays clearly visible at the front`
            : `${name} worn over ${under} as the outer layer`
        );
      } else {
        phrases.push(`${name} as the outer layer`);
      }
      tops.push(name);
    } else {
      phrases.push(name);
    }
  }
  return phrases;
}

const join = (list: string[]) => (list.length <= 1 ? (list[0] ?? "the garments") : `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`);

/**
 * The full instruction for dressing a whole outfit in one pass from a garment sheet (image 2). `pieces` must already be
 * in worn order (as laid out on the sheet).
 */
export function outfitPrompt(prefix: string, keepDetails: string, pieces: { role: string; name: string; description: string }[]): string {
  const named = pieces.map((p) => ({ role: p.role, name: p.name, openFront: OPEN_FRONT.test(p.description) }));
  const phrases = wornPhrases(named);
  if (pieces.length === 1) return `${prefix} ${phrases[0]} of image 2.${keepDetails}`;
  const sheet = pieces.map((p, i) => `${i + 1}) ${p.name}`).join(", ");
  const layered = pieces.some((p) => p.role === "outer_layer") && pieces.some((p) => TOP_ROLES.includes(p.role));
  return (
    `${prefix} ${join(phrases)}, all from image 2.` +
    ` Image 2 shows ${pieces.length} garments in reading order (left to right, top to bottom): ${sheet}.` +
    ` Every one of these garments must appear on the person${layered ? ", with each top layered exactly as described" : ""}.` +
    keepDetails
  );
}

export { isOpenFront };
