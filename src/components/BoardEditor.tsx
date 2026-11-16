"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/Dialog";
import {
  BOARD_COLORS,
  TEXT_COLORS,
  TEXT_STYLES,
  isCutout,
  measureText,
  pictureSize,
  textPx,
  withoutBackground,
  type Board,
  type BoardLayer,
  type TextStyle,
} from "@/lib/outfitBoard";

const MIN_SIZE = 0.04;
const MAX_SIZE = 1.6;
const MIN_CROP = 0.08;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rad = (deg: number) => (deg * Math.PI) / 180;
/** Turning snaps straight when it comes within a few degrees of upright or sideways. */
const snapped = (deg: number) => {
  const d = ((deg % 360) + 360) % 360;
  const near = Math.round(d / 90) * 90;
  return Math.abs(d - near) < 4 ? near % 360 : d;
};

/** Resizes a layer around its center by `factor`, keeping its shape. */
function scaled(l: BoardLayer, factor: number): BoardLayer {
  const f = clamp(factor, MIN_SIZE / l.w, MAX_SIZE / l.w);
  const w = l.w * f;
  const h = l.h * f;
  return { ...l, x: l.x + (l.w - w) / 2, y: l.y + (l.h - h) / 2, w, h };
}

type Side = "l" | "t" | "r" | "b";
type Gesture = {
  key: string;
  start: BoardLayer;
  from: { x: number; y: number };
  /** Two fingers: how far apart they started, and at what angle. */
  spread: number | null;
  angle: number | null;
  mode: "move" | "corner" | "turn" | Side;
  moved: boolean;
  /** It was already chosen when this touch began (a tap on chosen text opens it for editing). */
  wasSelected: boolean;
};

let made = 0;
const newKey = (kind: string) => `${kind}-${++made}`;

/**
 * Arrange the post's picture like a story: tap something to choose it, drag to move, pinch (or drag its corner) to
 * resize, twist (or drag the round handle) to turn. Chosen pictures can be cropped, cut out, replaced, layered or
 * deleted; text can be added and styled; the board's color changed. Nothing is drawn until Done: these are just
 * positions. Everything happens on this device (no AI, nothing paid).
 */
export function BoardEditor({
  board,
  onChange,
  onAddPiece,
  onReplace,
  onDeleted,
}: {
  board: Board;
  onChange: (board: Board) => void;
  /** Add a piece from the closet or Shopping (the page shows its picker). */
  onAddPiece?: () => void;
  /** Swap this piece for another one (the page shows its picker). */
  onReplace?: (key: string) => void;
  /** A layer was deleted (the page drops the piece it stood for). */
  onDeleted?: (key: string) => void;
}) {
  const { layers } = board;
  const box = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const addPicture = useRef<HTMLInputElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);

  const rect = () => box.current?.getBoundingClientRect() ?? { width: 1, height: 1, left: 0, top: 0 };
  const twoFingers = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? { spread: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x) } : null;
  };
  const setLayers = (next: BoardLayer[]) => onChange({ ...board, layers: next });
  const update = (key: string, next: BoardLayer) => setLayers(layers.map((l) => (l.key === key ? next : l)));
  const current = layers.find((l) => l.key === selected) ?? null;

  function choose(key: string | null) {
    setSelected(key);
    setCropping(false);
    setShowColors(false);
  }

  function down(e: React.PointerEvent, key: string, mode: Gesture["mode"] = "move") {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const running = gesture.current;
    // A second finger joins the pinch on what's already being moved.
    const k = running && pointers.current.size === 2 ? running.key : key;
    const layer = layers.find((l) => l.key === k);
    if (!layer) return;
    const two = twoFingers();
    gesture.current = {
      key: k,
      start: layer,
      from: { x: e.clientX, y: e.clientY },
      spread: two?.spread ?? null,
      angle: two?.angle ?? null,
      mode: two ? "move" : mode,
      moved: Boolean(running),
      wasSelected: selected === k,
    };
    if (selected !== k) choose(k);
  }

  /** A touch on a layer, or on one of its handles (which say what they do in `data-mode`). */
  function layerDown(e: React.PointerEvent<HTMLElement>) {
    const key = e.currentTarget.dataset.key;
    const mode = ((e.target as HTMLElement).dataset.mode ?? "move") as Gesture["mode"];
    if (key) down(e, key, mode);
  }

  function move(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const { width: BW, height: BH, left, top } = rect();
    const s = g.start;
    const dx = e.clientX - g.from.x;
    const dy = e.clientY - g.from.y;
    if (Math.hypot(dx, dy) > 4) g.moved = true;
    const center = { x: left + (s.x + s.w / 2) * BW, y: top + (s.y + s.h / 2) * BH };
    const two = twoFingers();

    if (two && g.spread && g.angle !== null) {
      // Two fingers: pinch to resize, twist to turn.
      const turned = ((two.angle - g.angle) * 180) / Math.PI;
      update(g.key, { ...scaled(s, two.spread / g.spread), rot: snapped((s.rot ?? 0) + turned) });
    } else if (g.mode === "corner") {
      // The corner: drag away from the middle to grow, toward it to shrink.
      const was = Math.hypot(g.from.x - center.x, g.from.y - center.y) || 1;
      update(g.key, scaled(s, Math.hypot(e.clientX - center.x, e.clientY - center.y) / was));
    } else if (g.mode === "turn") {
      // The round handle above: points the top of the layer toward the finger.
      const deg = (Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180) / Math.PI + 90;
      update(g.key, { ...s, rot: snapped(deg) });
    } else if (g.mode === "move") {
      update(g.key, {
        ...s,
        x: clamp(s.x + dx / BW, -s.w * 0.75, 1 - s.w * 0.25),
        y: clamp(s.y + dy / BH, -s.h * 0.75, 1 - s.h * 0.25),
      });
    } else {
      update(g.key, cropped(s, g.mode, dx, dy, BW, BH));
    }
  }

  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    const layer = layers.find((l) => l.key === g.key);
    // A tap on text that was already chosen opens it for editing.
    if (!g.moved && g.wasSelected && g.mode === "move" && layer?.text !== undefined) setEditingText(layer.key);
    // A finger lifted from a pinch: carry on dragging with the other one from where the layer is now.
    const rest = [...pointers.current.values()][0];
    gesture.current = rest && layer ? { ...g, start: layer, from: rest, spread: null, angle: null, mode: "move", moved: true } : null;
  }

  function restack(step: 1 | -1) {
    const i = layers.findIndex((l) => l.key === selected);
    const j = i + step;
    if (i < 0 || j < 0 || j >= layers.length) return;
    const next = [...layers];
    [next[i], next[j]] = [next[j], next[i]];
    setLayers(next);
  }

  function remove() {
    if (!current) return;
    setLayers(layers.filter((l) => l.key !== current.key));
    onDeleted?.(current.key);
    choose(null);
  }

  function addText() {
    const px = board.height * 0.05;
    const size = measureText("Your text", "serif", px, board);
    const layer: BoardLayer = { key: newKey("text"), src: "", text: "Your text", font: "serif", color: board.background === "#121821" ? "#ffffff" : "#121821", x: 0.5 - size.w / 2, y: 0.5 - size.h / 2, ...size };
    setLayers([...layers, layer]);
    choose(layer.key);
    setEditingText(layer.key);
  }

  /** A picture from the device, shrunk here (it stays on the device until Post). */
  async function addPictureFile(file: File) {
    setBusy("Adding…");
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const src = canvas.toDataURL("image/webp", 0.88);
      let w = 0.5;
      let h = (w * board.width * canvas.height) / (canvas.width * board.height);
      if (h > 0.6) {
        w *= 0.6 / h;
        h = 0.6;
      }
      const layer: BoardLayer = { key: newKey("pic"), src, x: 0.5 - w / 2, y: 0.5 - h / 2, w, h };
      setLayers([...layers, layer]);
      choose(layer.key);
    } catch {}
    setBusy(null);
  }

  /** Removes the chosen picture's background, on this device (free). */
  async function cutOutCurrent() {
    if (!current) return;
    setBusy("Cutting out…");
    const src = await withoutBackground(current.src);
    const size = src !== current.src ? await pictureSize(src) : null;
    if (size) {
      // Same width and middle; the height follows the cut-out's own shape.
      const h = (current.w * board.width * size.height) / (size.width * board.height);
      update(current.key, { ...current, src, crop: undefined, flat: false, h, y: current.y + (current.h - h) / 2 });
      return setBusy(null);
    }
    // Nothing clear to keep: the picture stays as it was.
    setBusy("No clear piece found");
    setTimeout(() => setBusy(null), 1800);
  }

  const index = layers.findIndex((l) => l.key === selected);
  const ratio = board.width / board.height;
  const tool = "shrink-0 rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] disabled:opacity-40";
  const toolOn = "shrink-0 rounded-full bg-[#121821] px-3.5 py-1.5 text-[12.5px] font-semibold text-white";
  const textLayer = editingText ? layers.find((l) => l.key === editingText) : null;

  return (
    <div>
      <div
        ref={box}
        onPointerDown={(e) => {
          // A second finger anywhere on the board joins the pinch.
          const g = gesture.current;
          if (g && pointers.current.size === 1) {
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const layer = layers.find((l) => l.key === g.key);
            const two = twoFingers();
            if (layer && two) gesture.current = { ...g, start: layer, spread: two.spread, angle: two.angle, mode: "move", moved: true };
            return;
          }
          // Otherwise a tap on the empty board lets go.
          choose(null);
        }}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="relative mx-auto touch-none select-none overflow-hidden rounded-[18px]"
        style={{ aspectRatio: ratio, width: `min(100%, calc(56dvh * ${ratio}))`, background: board.background }}
      >
        {layers.map((l) => {
          const on = l.key === selected;
          const [cl, ct, cr, cb] = l.crop ?? [0, 0, 1, 1];
          const lines = l.text !== undefined ? l.text.split("\n").length : 1;
          return (
            <div
              key={l.key}
              data-key={l.key}
              onPointerDown={layerDown}
              className={`absolute cursor-grab active:cursor-grabbing ${on ? "outline outline-2 outline-offset-2 outline-[#121821]/70" : ""}`}
              style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.w * 100}%`, height: `${l.h * 100}%`, transform: l.rot ? `rotate(${l.rot}deg)` : undefined }}
            >
              {l.text !== undefined ? (
                <TextLayer layer={l} lines={lines} />
              ) : (
                <>
                  {/* While cropping, the parts cut away show faintly. */}
                  {on && cropping && (
                    // eslint-disable-next-line @next/next/no-img-element -- the person's own picture, being cropped
                    <img
                      src={l.src}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute max-w-none opacity-25"
                      style={{ width: `${100 / (cr - cl)}%`, height: `${100 / (cb - ct)}%`, left: `${(-cl / (cr - cl)) * 100}%`, top: `${(-ct / (cb - ct)) * 100}%` }}
                    />
                  )}
                  <div className={`pointer-events-none absolute inset-0 overflow-hidden ${l.flat ? "" : "drop-shadow-[0_6px_10px_rgba(18,24,33,0.14)]"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- the person's own pieces and photos, being arranged */}
                    <img
                      src={l.src}
                      alt=""
                      draggable={false}
                      className="absolute max-w-none"
                      style={{ width: `${100 / (cr - cl)}%`, height: `${100 / (cb - ct)}%`, left: `${(-cl / (cr - cl)) * 100}%`, top: `${(-ct / (cb - ct)) * 100}%` }}
                    />
                  </div>
                </>
              )}
              {on && !cropping && (
                <>
                  {/* Handles sit just outside the box, or inside it when the box reaches the board's edge. */}
                  <span
                    data-mode="corner"
                    aria-hidden
                    className={`absolute h-6 w-6 cursor-nwse-resize rounded-full border-2 border-white bg-[#121821] shadow ${l.x + l.w > 0.97 || l.y + l.h > 0.97 ? "bottom-2 right-2" : "-bottom-3 -right-3"}`}
                  />
                  {/* Turn: drag the round handle around. */}
                  {l.y > 0.07 && <span aria-hidden className="pointer-events-none absolute -top-7 left-1/2 h-5 w-px -translate-x-1/2 bg-[#121821]/60" />}
                  <span
                    data-mode="turn"
                    aria-hidden
                    className={`absolute left-1/2 h-6 w-6 -translate-x-1/2 cursor-grab rounded-full border-2 border-[#121821] bg-white shadow ${l.y > 0.07 ? "-top-10" : "top-2"}`}
                  />
                </>
              )}
              {on && cropping &&
                (["l", "t", "r", "b"] as const).map((side) => (
                  <span
                    key={side}
                    data-mode={side}
                    aria-hidden
                    className={`absolute rounded-full border-2 border-white bg-[#121821] shadow ${
                      side === "l"
                        ? "-left-2 top-1/2 h-10 w-4 -translate-y-1/2 cursor-ew-resize"
                        : side === "r"
                          ? "-right-2 top-1/2 h-10 w-4 -translate-y-1/2 cursor-ew-resize"
                          : side === "t"
                            ? "-top-2 left-1/2 h-4 w-10 -translate-x-1/2 cursor-ns-resize"
                            : "-bottom-2 left-1/2 h-4 w-10 -translate-x-1/2 cursor-ns-resize"
                    }`}
                  />
                ))}
            </div>
          );
        })}
        {busy && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <span className="rounded-full bg-[#121821]/85 px-3.5 py-1.5 text-[12px] font-semibold text-white">{busy}</span>
          </div>
        )}
      </div>

      {/* Tools for what's chosen, or for the board when nothing is. */}
      <div className="mt-3 flex min-h-[36px] flex-wrap items-center gap-2">
        {current && current.text !== undefined ? (
          <>
            <button type="button" onClick={() => setEditingText(current.key)} className={tool}>
              Edit
            </button>
            <button type="button" onClick={() => restack(-1)} disabled={index <= 0} className={tool}>
              Back
            </button>
            <button type="button" onClick={() => restack(1)} disabled={index >= layers.length - 1} className={tool}>
              Forward
            </button>
            <button type="button" onClick={remove} className={`${tool} !text-[#a1312a]`}>
              Delete
            </button>
          </>
        ) : current ? (
          <>
            <button type="button" onClick={() => setCropping((c) => !c)} aria-pressed={cropping} className={cropping ? toolOn : tool}>
              {cropping ? "Done cropping" : "Crop"}
            </button>
            {!cropping && (
              <>
                {onReplace && current.key.match(/^(closet|shop|new)-/) && (
                  <button type="button" onClick={() => onReplace(current.key)} className={tool}>
                    Replace
                  </button>
                )}
                {!isCutout(current.src) && (
                  <button type="button" onClick={cutOutCurrent} disabled={Boolean(busy)} className={tool}>
                    Cut out
                  </button>
                )}
                <button type="button" onClick={() => update(current.key, { ...current, rot: 0 })} disabled={!current.rot} className={tool}>
                  Straighten
                </button>
                <button type="button" onClick={() => restack(-1)} disabled={index <= 0} className={tool}>
                  Back
                </button>
                <button type="button" onClick={() => restack(1)} disabled={index >= layers.length - 1} className={tool}>
                  Forward
                </button>
                <button type="button" onClick={remove} className={`${tool} !text-[#a1312a]`}>
                  Delete
                </button>
              </>
            )}
          </>
        ) : (
          <>
            {onAddPiece && (
              <button type="button" onClick={onAddPiece} className={tool}>
                ＋ Piece
              </button>
            )}
            <button type="button" onClick={() => addPicture.current?.click()} disabled={Boolean(busy)} className={tool}>
              ＋ Picture
            </button>
            <button type="button" onClick={addText} className={tool}>
              ＋ Text
            </button>
            <button type="button" onClick={() => setShowColors((s) => !s)} aria-pressed={showColors} className={showColors ? toolOn : tool}>
              Background
            </button>
          </>
        )}
      </div>
      {showColors && !current && (
        <div className="mt-2 flex items-center gap-2.5">
          {BOARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...board, background: c })}
              aria-label={`Background ${c}`}
              aria-pressed={board.background === c}
              className={`h-8 w-8 rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,33,0.16)] ${board.background === c ? "ring-2 ring-[#121821] ring-offset-2" : ""}`}
              style={{ background: c }}
            />
          ))}
        </div>
      )}
      <p className="mt-1.5 text-[11.5px] text-[#8a949e]">
        {cropping ? "Drag the edges to crop" : "Drag · pinch to resize · twist to turn"}
      </p>
      <input
        ref={addPicture}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void addPictureFile(file);
        }}
      />
      {textLayer && (
        <TextSheet
          layer={textLayer}
          onClose={() => setEditingText(null)}
          onSave={(text, font, color) => {
            const was = textLayer;
            if (!text.trim()) {
              setLayers(layers.filter((l) => l.key !== was.key));
              choose(null);
              return setEditingText(null);
            }
            // Same text size and middle; the box fits the new words.
            const px = textPx(was.h, (was.text ?? "").split("\n").length, board.height);
            const size = measureText(text, font, px, board);
            update(was.key, { ...was, text, font, color, ...size, x: was.x + (was.w - size.w) / 2, y: was.y + (was.h - size.h) / 2 });
            setEditingText(null);
          }}
        />
      )}
    </div>
  );
}

/** Crops one side by dragging its handle (the picture stays where it is; only that side moves). */
function cropped(s: BoardLayer, side: Side, dx: number, dy: number, BW: number, BH: number): BoardLayer {
  const [l, t, r, b] = s.crop ?? [0, 0, 1, 1];
  const a = rad(s.rot ?? 0);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // The drag along the layer's own (turned) sides.
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  const wpx = s.w * BW;
  const hpx = s.h * BH;
  const kx = wpx / (r - l);
  const ky = hpx / (b - t);
  const crop: [number, number, number, number] = [l, t, r, b];
  let nw = wpx;
  let nh = hpx;
  let shift = { x: 0, y: 0 };
  if (side === "r") {
    crop[2] = clamp(r + lx / kx, l + MIN_CROP, 1);
    nw = (crop[2] - l) * kx;
    shift = { x: (nw - wpx) / 2, y: 0 };
  } else if (side === "l") {
    crop[0] = clamp(l + lx / kx, 0, r - MIN_CROP);
    nw = (r - crop[0]) * kx;
    shift = { x: -(nw - wpx) / 2, y: 0 };
  } else if (side === "b") {
    crop[3] = clamp(b + ly / ky, t + MIN_CROP, 1);
    nh = (crop[3] - t) * ky;
    shift = { x: 0, y: (nh - hpx) / 2 };
  } else {
    crop[1] = clamp(t + ly / ky, 0, b - MIN_CROP);
    nh = (b - crop[1]) * ky;
    shift = { x: 0, y: -(nh - hpx) / 2 };
  }
  const cx = (s.x + s.w / 2) * BW + shift.x * cos - shift.y * sin;
  const cy = (s.y + s.h / 2) * BH + shift.x * sin + shift.y * cos;
  return { ...s, crop, w: nw / BW, h: nh / BH, x: (cx - nw / 2) / BW, y: (cy - nh / 2) / BH };
}

const FONT_CSS: Record<TextStyle, React.CSSProperties> = {
  serif: { fontFamily: "var(--font-instrument-serif), Georgia, serif", fontWeight: 400 },
  sans: { fontFamily: "var(--font-dm-sans), Arial, sans-serif", fontWeight: 500 },
  bold: { fontFamily: "var(--font-dm-sans), Arial, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" },
};

/** Text on the board, sized to fill its box's height (so pinching it makes the words bigger). */
function TextLayer({ layer, lines }: { layer: BoardLayer; lines: number }) {
  return (
    <div className="pointer-events-none h-full w-full" style={{ containerType: "size" }}>
      <div
        className="flex h-full w-full items-center justify-center whitespace-pre text-center"
        style={{ ...FONT_CSS[layer.font ?? "serif"], color: layer.color, fontSize: `${(100 / lines / 1.2).toFixed(3)}cqh`, lineHeight: 1.2 }}
      >
        {layer.text}
      </div>
    </div>
  );
}

/** Writing and styling a text layer. */
function TextSheet({ layer, onClose, onSave }: { layer: BoardLayer; onClose: () => void; onSave: (text: string, font: TextStyle, color: string) => void }) {
  const [text, setText] = useState(layer.text ?? "");
  const [font, setFont] = useState<TextStyle>(layer.font ?? "serif");
  const [color, setColor] = useState(layer.color ?? "#121821");
  return createPortal(
    <Dialog label="Text" onClose={onClose} className="w-full max-w-sm rounded-[22px] bg-white p-4 shadow-xl">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 80))}
        rows={2}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        className="block w-full resize-none rounded-[14px] bg-[#f6f5f2] px-3.5 py-3 text-center text-[20px] text-[#121821] outline-none"
        style={FONT_CSS[font]}
      />
      <div className="mt-3 flex gap-2">
        {TEXT_STYLES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setFont(s.value)}
            aria-pressed={font === s.value}
            className={`flex-1 rounded-full py-1.5 text-[13px] ${font === s.value ? "bg-[#121821] text-white" : "bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]"}`}
            style={FONT_CSS[s.value]}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2.5">
        {TEXT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
            aria-pressed={color === c}
            className={`h-8 w-8 rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,33,0.16)] ${color === c ? "ring-2 ring-[#121821] ring-offset-2" : ""}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <button type="button" onClick={() => onSave(text, font, color)} className="mt-4 w-full rounded-full bg-[#121821] py-3 text-[14.5px] font-semibold text-white">
        Done
      </button>
    </Dialog>,
    document.body
  );
}
