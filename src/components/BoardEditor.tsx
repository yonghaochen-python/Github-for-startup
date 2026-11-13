"use client";

import { useRef, useState } from "react";
import { BOARD_BACKGROUND, BOARD_RATIO, type BoardLayer } from "@/lib/outfitBoard";

const MIN_SIZE = 0.06;
const MAX_SIZE = 1.3;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Resizes a layer around its center by `factor`, keeping its shape. */
function scaled(l: BoardLayer, factor: number): BoardLayer {
  const f = clamp(factor, MIN_SIZE / l.w, MAX_SIZE / l.w);
  const w = l.w * f;
  const h = l.h * f;
  return { ...l, x: l.x + (l.w - w) / 2, y: l.y + (l.h - h) / 2, w, h };
}

/**
 * Arrange the outfit board like a story post: tap a piece to choose it, drag to move, pinch (or drag its corner) to
 * resize, Forward / Back to change what lies on top. Nothing is drawn until Done; the layers are just positions.
 */
export function BoardEditor({ layers, onChange }: { layers: BoardLayer[]; onChange: (layers: BoardLayer[]) => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // Fingers / mouse currently down, and how the gesture started.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ key: string; start: BoardLayer; from: { x: number; y: number }; spread: number | null; corner: boolean } | null>(null);

  const size = () => box.current?.getBoundingClientRect() ?? { width: 1, height: 1, left: 0, top: 0 };
  const spreadOf = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
  };
  const update = (key: string, next: BoardLayer) => onChange(layers.map((l) => (l.key === key ? next : l)));

  function down(e: React.PointerEvent, key: string, corner = false) {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setSelected(key);
    const layer = layers.find((l) => l.key === key);
    if (!layer) return;
    gesture.current = { key, start: layer, from: { x: e.clientX, y: e.clientY }, spread: spreadOf(), corner };
  }

  function move(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const { width, height } = size();
    const spread = spreadOf();
    if (spread && g.spread) {
      // Two fingers: pinch to resize around the piece's center.
      update(g.key, scaled(g.start, spread / g.spread));
    } else if (g.corner) {
      // The corner handle: drag outward to grow, inward to shrink.
      const dx = (e.clientX - g.from.x) / width;
      update(g.key, scaled(g.start, (g.start.w + dx * 2) / g.start.w));
    } else {
      const dx = (e.clientX - g.from.x) / width;
      const dy = (e.clientY - g.from.y) / height;
      update(g.key, {
        ...g.start,
        x: clamp(g.start.x + dx, -g.start.w * 0.6, 1 - g.start.w * 0.4),
        y: clamp(g.start.y + dy, -g.start.h * 0.6, 1 - g.start.h * 0.4),
      });
    }
  }

  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    // A finger lifted from a pinch: carry on dragging with the other one from where the piece is now.
    const layer = layers.find((l) => l.key === g.key);
    const rest = [...pointers.current.values()][0];
    gesture.current = rest && layer ? { key: g.key, start: layer, from: rest, spread: null, corner: false } : null;
  }

  function restack(step: 1 | -1) {
    const i = layers.findIndex((l) => l.key === selected);
    const j = i + step;
    if (i < 0 || j < 0 || j >= layers.length) return;
    const next = [...layers];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  const index = layers.findIndex((l) => l.key === selected);
  return (
    <div>
      <div
        ref={box}
        onPointerDown={(e) => {
          // A second finger anywhere on the board joins the pinch on the piece being moved.
          const g = gesture.current;
          if (g && pointers.current.size === 1) {
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const layer = layers.find((l) => l.key === g.key);
            if (layer) gesture.current = { ...g, start: layer, spread: spreadOf(), corner: false };
            return;
          }
          // Otherwise a tap on the empty board lets go of the chosen piece.
          setSelected(null);
        }}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="relative w-full touch-none select-none overflow-hidden rounded-[18px]"
        style={{ aspectRatio: BOARD_RATIO, background: BOARD_BACKGROUND }}
      >
        {layers.map((l) => {
          const on = l.key === selected;
          return (
            <div
              key={l.key}
              onPointerDown={(e) => down(e, l.key)}
              className={`absolute cursor-grab active:cursor-grabbing ${on ? "outline outline-2 outline-offset-2 outline-[#121821]/70" : ""}`}
              style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.w * 100}%`, height: `${l.h * 100}%` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the person's own pieces, being arranged */}
              <img src={l.src} alt="" draggable={false} className="pointer-events-none h-full w-full drop-shadow-[0_6px_10px_rgba(18,24,33,0.14)]" />
              {on && (
                <span
                  onPointerDown={(e) => down(e, l.key, true)}
                  aria-hidden
                  className="absolute -bottom-2.5 -right-2.5 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-[#121821] shadow"
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex min-h-[40px] items-center justify-center gap-2 text-[12.5px]">
        {selected ? (
          <>
            <button type="button" onClick={() => restack(-1)} disabled={index <= 0} className="rounded-full bg-white px-3.5 py-1.5 font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] disabled:opacity-40">
              Back
            </button>
            <button type="button" onClick={() => restack(1)} disabled={index >= layers.length - 1} className="rounded-full bg-white px-3.5 py-1.5 font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] disabled:opacity-40">
              Forward
            </button>
          </>
        ) : (
          <p className="text-[#8a949e]">Drag to move · pinch to resize · tap a piece to layer it</p>
        )}
      </div>
    </div>
  );
}
