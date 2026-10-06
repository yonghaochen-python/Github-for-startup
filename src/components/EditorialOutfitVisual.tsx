import Image from "next/image";
import type { LayeringRole } from "@/lib/layering";

type Garment = {
  id: string;
  imageUrl: string;
  description: string;
  layeringRole: LayeringRole;
};

const WORN_PRIORITY: LayeringRole[] = ["outer_layer", "one_piece", "mid_layer"];

/**
 * Editorial "look breakdown" presentation: a numbered rail of the outfit's own
 * item photos on the left, and the single most outer/dominant piece blown up
 * large on the right standing in for a composed "worn" shot (no real
 * person-wearing-outfit compositing exists yet, so this reuses real item photos
 * rather than faking one).
 */
export function EditorialOutfitVisual({ items, large = false }: { items: Garment[]; large?: boolean }) {
  const nonAccessory = items.filter((i) => i.layeringRole !== "accessory");
  const wornItem = nonAccessory.find((i) => WORN_PRIORITY.includes(i.layeringRole)) ?? nonAccessory[0] ?? items[0];
  const visible = large ? items : items.slice(0, 3);
  const hiddenCount = items.length - visible.length;

  return (
    <div
      className={`grid overflow-hidden bg-white ${large ? "min-h-[520px] sm:min-h-[640px]" : "min-h-[320px] sm:min-h-[390px]"}`}
      style={{ gridTemplateColumns: "minmax(112px, 32%) minmax(0, 1fr)" }}
    >
      <div className="relative z-10 flex flex-col gap-4 border-r border-[#dce2e4] px-3 py-6 sm:px-5 sm:py-8">
        {visible.map((item, i) => (
          <div key={item.id} className="grid flex-1 grid-cols-[20px_minmax(0,1fr)] items-center gap-2">
            <span className="self-start pt-1 text-[10px] font-bold tracking-widest text-[#29343a]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="relative h-full min-h-[48px] w-full">
              <Image
                src={item.imageUrl}
                alt={item.description}
                fill
                unoptimized
                className="object-contain mix-blend-multiply saturate-[.86]"
                style={{ objectFit: "contain" }}
              />
            </div>
          </div>
        ))}
        {!large && hiddenCount > 0 && (
          <span className="text-right text-[9px] font-bold tracking-wider text-[#89949a]">
            +{hiddenCount} PIECE{hiddenCount === 1 ? "" : "S"}
          </span>
        )}
      </div>

      <div className="relative min-w-0 overflow-hidden bg-[#faf9f7] after:absolute after:inset-x-[12%] after:bottom-[8%] after:h-[9%] after:rounded-full after:bg-[#29343a]/10 after:blur-xl after:content-['']">
        {wornItem && (
          <Image
            src={wornItem.imageUrl}
            alt={wornItem.description}
            fill
            unoptimized
            className="relative z-10 object-contain object-bottom saturate-[.88] contrast-[.98]"
            style={{ objectFit: "contain" }}
          />
        )}
        <span className="absolute right-4 bottom-4 z-20 text-[9px] font-bold tracking-widest text-[#89949a] [writing-mode:vertical-rl]">
          THE COMPLETE LOOK
        </span>
      </div>
    </div>
  );
}
