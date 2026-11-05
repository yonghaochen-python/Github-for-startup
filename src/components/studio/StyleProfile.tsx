"use client";

import Link from "next/link";
import { JEWELRY_INFO } from "@/lib/studioStyle";
import type { PortraitInfo, StudioModuleId, Swatch } from "@/lib/studioModules";
import type { StyleProfile } from "@/lib/styleProfile";

function Dots({ list, size = "h-6 w-6" }: { list: Swatch[]; size?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((s) => (
        <span key={s.hex + s.name} title={s.name} className={`${size} rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)]`} style={{ background: s.hex }} />
      ))}
    </div>
  );
}

/** One part of the profile: what it says, or a way to make it. */
function Tile({
  label,
  module,
  ready,
  earlier,
  children,
}: {
  label: string;
  module: StudioModuleId;
  ready: boolean;
  earlier: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={`/stylist/${module}`}
      className={`group flex min-w-0 flex-col gap-2 rounded-[18px] p-4 transition hover:-translate-y-0.5 ${ready ? "bg-white" : "border border-dashed border-[#c9d0d6] bg-white/50"}`}
    >
      <p className="flex items-center justify-between gap-2 text-[10.5px] font-semibold uppercase tracking-[1.8px] text-[#5d6874]">
        {label}
        {earlier && <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9.5px] normal-case tracking-normal text-amber-800">earlier photo</span>}
      </p>
      {ready ? children : <p className="text-[13px] font-semibold text-[#121821]">Analyze →</p>}
    </Link>
  );
}

/**
 * The Unified Style Profile: the newest result of each analysis in one place (colors, makeup, hair, style, jewelry),
 * from saved reports only. Any part not made yet links to its analysis; nothing is required first.
 */
export function StyleProfileBoard({ profile, portrait }: { profile: StyleProfile; portrait: PortraitInfo | null }) {
  const earlier = (module: StudioModuleId) => {
    const s = profile.sources.find((x) => x.module === module);
    return Boolean(s && portrait && s.portraitVersion && s.portraitVersion !== portrait.version);
  };
  const { color, makeup, hair, style, jewelry } = profile;
  const name = (j: keyof typeof JEWELRY_INFO) => JEWELRY_INFO[j].name;

  return (
    <section aria-label="Your Style Profile" className="mt-12 rounded-[28px] bg-[#f4f1ec] p-5 shadow-[0_24px_60px_rgba(18,30,45,0.12)] sm:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-[34px] leading-none text-[#121821] sm:text-[40px]">Your Style Profile</h2>
        <p className="text-[12px] text-[#5d6874]">From your reports · {profile.sources.length} of 4</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Colors" module="color" ready={Boolean(color)} earlier={earlier("color")}>
          {color && (
            <>
              <p className="font-display text-[22px] leading-tight text-[#121821]">{color.season}</p>
              <Dots list={color.best.slice(0, 6)} />
              {color.avoid.length > 0 && (
                <div className="flex items-center gap-2 opacity-70">
                  <span className="text-[10.5px] text-[#5d6874]">Go easy</span>
                  <Dots list={color.avoid.slice(0, 3)} size="h-4 w-4" />
                </div>
              )}
            </>
          )}
        </Tile>

        <Tile label="Makeup" module="makeup" ready={Boolean(makeup)} earlier={earlier("makeup")}>
          {makeup && (
            <>
              <p className="font-display text-[22px] leading-tight text-[#121821]">{makeup.style}</p>
              <Dots list={[...makeup.lips.slice(0, 3), ...makeup.blush.slice(0, 2)]} />
            </>
          )}
        </Tile>

        <Tile label="Hair" module="hair" ready={Boolean(hair)} earlier={earlier("hair")}>
          {hair && (
            <>
              <p className="font-display text-[20px] leading-tight text-[#121821]">{hair.style}</p>
              <p className="text-[12.5px] text-[#4f5b66]">{hair.color}</p>
              <Dots list={hair.colors} />
            </>
          )}
        </Tile>

        <Tile label="Style" module="style" ready={Boolean(style)} earlier={earlier("style")}>
          {style && (
            <>
              <p className="font-display text-[22px] leading-tight text-[#121821]">{style.direction}</p>
              <ul className="flex flex-wrap gap-1">
                {style.keywords.slice(0, 4).map((k) => (
                  <li key={k} className="rounded-full bg-[#f4f6f8] px-2 py-0.5 text-[11px] text-[#2b3540]">
                    {k}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Tile>

        <Tile label="Jewelry" module="style" ready={Boolean(jewelry?.best.length || jewelry?.also.length)} earlier={earlier("style")}>
          {jewelry && (
            <>
              <div className="flex gap-1.5">
                {[...jewelry.best, ...jewelry.also].slice(0, 4).map((j) => (
                  <span key={j} title={name(j)} className="h-7 w-7 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.15)]" style={{ background: JEWELRY_INFO[j].finish }} />
                ))}
              </div>
              <p className="text-[12.5px] font-medium text-[#121821]">{jewelry.best.map(name).join(", ") || jewelry.also.map(name).join(", ")}</p>
            </>
          )}
        </Tile>
      </div>
    </section>
  );
}
