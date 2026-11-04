"use client";

import type { ClothingItem, Outfit } from "@/components/OutfitCard";
import type { LayeringRole } from "@/lib/layering";
import { retryImage } from "@/lib/retryImage";
import { PersonPicture } from "@/components/PersonPicture";

/** Top layers first, then what's below them: the order the pieces are numbered in. */
const ORDER: LayeringRole[] = ["outer_layer", "mid_layer", "base_layer", "one_piece", "bottom", "shoes", "accessory"];
const TOPS: LayeringRole[] = ["outer_layer", "mid_layer", "base_layer", "one_piece"];

const isCutout = (p: ClothingItem) => p.imageUrl.startsWith("/uploads/cut-");

function Piece({ piece, className = "" }: { piece: ClothingItem; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={piece.imageUrl}
      alt={piece.description}
      onError={retryImage}
      loading="lazy"
      className={`h-full w-full object-contain ${isCutout(piece) ? "drop-shadow-[0_8px_12px_rgba(18,24,33,0.14)]" : "rounded-[10px]"} ${className}`}
    />
  );
}

/**
 * The whole look standing up, top to bottom: the outer top (with what's under it peeking out), then the bottom,
 * then the shoes. Made only from the outfit's own photos (no AI, no credit), so it never pretends to be a person.
 */
function Standing({ pieces }: { pieces: ClothingItem[] }) {
  const tops = pieces.filter((p) => TOPS.includes(p.layeringRole));
  const onePiece = tops.find((p) => p.layeringRole === "one_piece");
  const bottom = pieces.find((p) => p.layeringRole === "bottom");
  const shoes = pieces.find((p) => p.layeringRole === "shoes");
  const [front, under] = tops; // tops are in ORDER: the outermost first
  const long = Boolean(onePiece && !bottom);

  return (
    <div className="absolute inset-0 flex flex-col items-center px-[8%] pb-[4%] pt-[6%]">
      {front && (
        <div className={`relative w-full ${long ? "h-[78%]" : "h-[40%]"}`}>
          {under && under !== front && (
            <div className="absolute inset-0 translate-x-[14%] translate-y-[8%] scale-[0.86] opacity-95">
              <Piece piece={under} />
            </div>
          )}
          <div className="relative h-full">
            <Piece piece={front} />
          </div>
        </div>
      )}
      {bottom && (
        <div className={`relative w-[86%] ${front ? "-mt-[4%] h-[44%]" : "h-[80%]"}`}>
          <Piece piece={bottom} />
        </div>
      )}
      {shoes && (
        <div className="relative mt-auto h-[13%] w-[52%]">
          <Piece piece={shoes} />
        </div>
      )}
    </div>
  );
}

/** The pieces numbered down a narrow column (01, 02, 03 …), top layers first, as on Saved Looks; past `max`, "+N PIECES". */
export function NumberedPieces({ pieces, max = 4, className = "" }: { pieces: ClothingItem[]; max?: number; className?: string }) {
  const sorted = [...pieces].sort((a, b) => ORDER.indexOf(a.layeringRole) - ORDER.indexOf(b.layeringRole));
  const listed = sorted.slice(0, max);
  const more = sorted.length - listed.length;
  return (
    <ol className={`flex min-h-0 flex-col gap-4 ${className}`}>
      {listed.map((p, i) => (
        <li key={p.id} className="grid min-h-0 flex-1 grid-cols-[20px_minmax(0,1fr)] items-center gap-2">
          <span className="self-start pt-1 text-[10px] font-bold tracking-widest text-[#29343a]">{String(i + 1).padStart(2, "0")}</span>
          <div className="relative h-full min-h-[40px] w-full">
            <Piece piece={p} className="absolute inset-0" />
          </div>
        </li>
      ))}
      {more > 0 && <li className="text-right text-[10.5px] font-bold tracking-wider text-[#5d6874]">+{more} PIECE{more === 1 ? "" : "S"}</li>}
    </ol>
  );
}

/**
 * A recommended look before it's used: its pieces numbered down the left (01, 02, 03 …) and the whole look on the
 * right — the person's own try-on of it when there is one, otherwise its pieces standing top to bottom.
 */
export function OutfitPreview({ outfit, className = "", lookOnly = false }: { outfit: Outfit; className?: string; /** Only the whole look (small cards). */ lookOnly?: boolean }) {
  const pieces = outfit.layers.flatMap((l) => l.items).sort((a, b) => ORDER.indexOf(a.layeringRole) - ORDER.indexOf(b.layeringRole));

  return (
    <div className={`grid bg-white ${lookOnly ? "grid-cols-1" : "grid-cols-[minmax(84px,32%)_minmax(0,1fr)]"} ${className}`}>
      {!lookOnly && <NumberedPieces pieces={pieces} className="border-r border-black/[0.07] px-3 py-5" />}
      <div className="relative min-h-0 bg-[#f7f7f5]">
        {outfit.tryOn ? (
          <PersonPicture src={`/api/outfits/${outfit.id}/try-on/image?v=${outfit.tryOn}`} alt="You wearing this look" className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <Standing pieces={pieces} />
        )}
      </div>
    </div>
  );
}
