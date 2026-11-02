"use client";

import type { StudioModule } from "@/lib/studioModules";

/**
 * A module's thumbnail: the person's own portrait, framed in that module's way (fabric drapes for color, makeup
 * pans, hair-color strands, jewelry and top colors), so the four feel like one set. Without a portrait, a soft
 * outline stands in.
 */
export function ModuleVisual({ module, portrait, className = "" }: { module: StudioModule; portrait: string | null; className?: string }) {
  const face = portrait ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={portrait} alt="" className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-end justify-center bg-gradient-to-b from-white/70 to-white/30">
      <div className="mb-[-12%] h-[70%] w-[70%] rounded-t-full bg-[#121821]/[0.06]" />
    </div>
  );
  const t = module.tones;

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: module.tint }} aria-hidden>
      {module.id === "color" && (
        <>
          {/* A portrait in an arch, over fabric drapes in the season colors, the way color analysts test colors. */}
          <div className="absolute inset-x-0 bottom-0 flex h-[34%]">
            {t.map((c) => (
              <div key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="absolute bottom-[14%] left-1/2 aspect-[3/4] h-[74%] -translate-x-1/2 overflow-hidden rounded-t-full shadow-[0_10px_30px_rgba(18,24,33,0.18)]">{face}</div>
        </>
      )}
      {module.id === "makeup" && (
        <>
          <div className="absolute left-[12%] top-1/2 aspect-square h-[72%] -translate-y-1/2 overflow-hidden rounded-full shadow-[0_10px_30px_rgba(18,24,33,0.16)]">{face}</div>
          <div className="absolute right-[9%] top-1/2 grid -translate-y-1/2 grid-cols-2 gap-2">
            {t.slice(0, 4).map((c) => (
              <span key={c} className="h-9 w-9 rounded-full shadow-[inset_0_-3px_6px_rgba(0,0,0,0.18),0_2px_6px_rgba(18,24,33,0.12)] sm:h-11 sm:w-11" style={{ background: c }} />
            ))}
          </div>
        </>
      )}
      {module.id === "hair" && (
        <>
          <div className="absolute bottom-0 left-[10%] aspect-[3/4] h-[86%] overflow-hidden rounded-t-[28px] shadow-[0_10px_30px_rgba(18,24,33,0.16)]">{face}</div>
          <div className="absolute right-[10%] top-[14%] flex h-[72%] gap-1.5">
            {t.map((c) => (
              <span key={c} className="w-3.5 rounded-full sm:w-4" style={{ background: `linear-gradient(180deg, ${c}, ${c}cc 70%, ${c}88)` }} />
            ))}
          </div>
        </>
      )}
      {module.id === "style" && (
        <>
          <div className="absolute bottom-0 left-1/2 aspect-[3/4] h-[86%] -translate-x-1/2 overflow-hidden rounded-t-[10px] shadow-[0_10px_30px_rgba(18,24,33,0.16)]">{face}</div>
          <div className="absolute left-[8%] top-[16%] flex flex-col gap-2">
            {t.slice(0, 3).map((c) => (
              <span key={c} className="h-6 w-10 rounded-[6px] shadow-[0_2px_6px_rgba(18,24,33,0.12)]" style={{ background: c }} />
            ))}
          </div>
          <div className="absolute right-[8%] top-[16%] flex flex-col gap-2">
            {["radial-gradient(circle at 35% 30%, #fffdf6, #e6dfcf 60%, #c9bfa9)", "radial-gradient(circle at 35% 30%, #fff1b8, #c9a227 60%, #8a6d12)", "radial-gradient(circle at 35% 30%, #ffffff, #c7ccd2 60%, #8b929a)"].map((g) => (
              <span key={g} className="h-7 w-7 rounded-full shadow-[0_2px_6px_rgba(18,24,33,0.18)]" style={{ background: g }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
