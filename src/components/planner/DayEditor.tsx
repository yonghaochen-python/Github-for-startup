"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ClothingItem } from "@/components/OutfitCard";
import type { DaySource, PlanDay } from "@/lib/planOutfits";
import { withPiece } from "@/lib/outfitPieces";
import { MirrorPieces } from "@/components/MirrorPieces";
import { OutfitFlatLay } from "@/components/OutfitFlatLay";
import { ClosetPicker, CLOSET_TABS, type Palette } from "@/components/ClosetPicker";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { useDialog } from "@/lib/useDialog";

const sameIds = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

function Spark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3.5 13.6 9a2 2 0 0 0 1.4 1.4l5.5 1.6-5.5 1.6a2 2 0 0 0-1.4 1.4L12 20.5 10.4 15A2 2 0 0 0 9 13.6L3.5 12 9 10.4A2 2 0 0 0 10.4 9z" />
    </svg>
  );
}

/**
 * One day of the Planner: the outfit on the left (numbered pieces with Replace and Remove, and the pieces laid out),
 * My Closet on the right (tap to add; it takes the place of a piece of its kind). Generate suggests another outfit
 * for this day only (free, no AI); Keep or Save stores it. Nothing changes on any other day, and no photo is made
 * here (Try On opens Studio, where a photo is made only when Try On is pressed).
 */
export function DayEditor({
  date,
  today,
  day,
  closet,
  palette,
  onClose,
  onSaved,
}: {
  date: string;
  today: string;
  day: PlanDay | undefined;
  closet: ClothingItem[];
  palette: Palette | null | undefined;
  onClose: () => void;
  onSaved: (day: PlanDay | null) => void;
}) {
  const byId = useMemo(() => new Map(closet.map((p) => [p.id, p])), [closet]);
  const saved = useMemo(() => (day?.items ?? []).flatMap((id) => byId.get(id) ?? []), [day, byId]);
  const [pieces, setPieces] = useState<ClothingItem[]>(saved);
  // How the outfit on screen came about: the saved one, a Generate suggestion, or the person's own changes.
  const [origin, setOrigin] = useState<"saved" | "generated" | "edited">("saved");
  const [replacing, setReplacing] = useState<string | null>(null);
  const [tab, setTab] = useState(CLOSET_TABS[0].value);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const closetRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialog(dialogRef, onClose, { escape: false });

  const ids = pieces.map((p) => p.id);
  const changed = !sameIds(ids, saved.map((p) => p.id));
  const chosen = useMemo(() => new Set(ids), [ids]);
  const past = date < today;
  const title = new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  // Escape closes; the page behind doesn't scroll while this is open.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  function edit(next: ClothingItem[]) {
    setPieces(next);
    setOrigin("edited");
    setNote(null);
  }

  /** A closet tap: replaces the piece being replaced, takes a chosen piece out, or adds it (in place of its kind). */
  function pick(item: ClothingItem) {
    if (replacing) {
      const rest = pieces.filter((p) => p.id !== replacing);
      setReplacing(null);
      edit(withPiece(rest, item));
    } else if (chosen.has(item.id)) edit(pieces.filter((p) => p.id !== item.id));
    else edit(withPiece(pieces, item));
  }

  function startReplace(piece: ClothingItem) {
    setReplacing(piece.id);
    if (CLOSET_TABS.some((t) => t.value === piece.category)) setTab(piece.category);
    // Phones: the closet is below the outfit.
    requestAnimationFrame(() => closetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function generate() {
    setBusy("generate");
    setNote(null);
    try {
      const res = await fetch("/api/planner/day", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, generate: true, current: ids }),
      });
      const data = (await res.json().catch(() => ({}))) as { items?: string[]; ranOut?: boolean; error?: string };
      if (!res.ok || !data.items) setNote(data.error ?? "Couldn't make another outfit. Try again.");
      else {
        setPieces(data.items.flatMap((id) => byId.get(id) ?? []));
        setOrigin("generated");
        setReplacing(null);
        if (data.ranOut) setNote("Add more pieces for more variety.");
      }
    } catch {
      setNote("Couldn't make another outfit. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setNote(null);
    // A kept suggestion is "chosen"; any change by hand is "edited". Either way the month's Generate Plan keeps it.
    const source: DaySource = origin === "generated" ? "chosen" : "edited";
    try {
      const res = await fetch("/api/planner/day", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, items: ids, source }),
      });
      const data = (await res.json().catch(() => ({}))) as { day?: PlanDay | null };
      if (!res.ok) throw new Error("save");
      onSaved(data.day ?? null);
    } catch {
      setNote("Couldn't save. Try again.");
      setBusy(null);
    }
  }

  function cancel() {
    setPieces(saved);
    setOrigin("saved");
    setReplacing(null);
    setNote(null);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/40 backdrop-blur-[2px] md:items-center md:p-6" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[1180px] flex-col overflow-hidden bg-white shadow-[0_40px_90px_rgba(0,0,0,0.3)] md:h-[min(88vh,820px)] md:rounded-[28px]"
      >
        <div className="flex items-center gap-3 border-b border-black/[0.06] px-5 py-4 sm:px-6">
          <h2 className="min-w-0 flex-1 truncate font-display text-[26px] font-normal leading-none text-[#121821] sm:text-[32px]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] text-[#121821] hover:bg-black/5">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] md:overflow-hidden">
          {/* The outfit: numbered pieces beside the pieces laid out. */}
          <section aria-label="Outfit" className="flex min-h-0 flex-col md:border-r md:border-black/[0.06]">
            <div className="grid min-h-[380px] flex-1 grid-cols-[minmax(84px,28%)_minmax(0,1fr)] bg-[linear-gradient(180deg,#f9f8f5_0%,#eeece7_100%)] max-md:h-[56vh] md:min-h-0">
              <div className="flex min-h-0 flex-col justify-center border-r border-black/[0.05] px-2 py-4 sm:px-3">
                <MirrorPieces pieces={pieces} replacing={replacing} onReplace={startReplace} onRemove={(p) => edit(pieces.filter((x) => x.id !== p.id))} />
              </div>
              <div className="relative min-h-0">
                <OutfitFlatLay pieces={pieces} emptyText="Pick pieces from your closet, or press Generate." />
              </div>
            </div>
            {replacing && (
              <div className="flex items-center gap-3 border-t border-black/[0.06] bg-[#121821] px-4 py-2.5 text-[12.5px] text-white">
                <span className="flex-1">Pick a replacement.</span>
                <button onClick={() => setReplacing(null)} className="font-semibold underline underline-offset-4">
                  Cancel
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.06] px-5 py-4 sm:px-6">
              {changed ? (
                <>
                  <button onClick={save} disabled={busy !== null || pieces.length === 0} className={btnPrimary}>
                    {busy === "save" ? "Saving…" : origin === "generated" ? "Keep" : "Save"}
                  </button>
                  {!past && (
                    <button onClick={generate} disabled={busy !== null} className={btnSecondary}>
                      <Spark /> {busy === "generate" ? "Generating…" : "Generate"}
                    </button>
                  )}
                  <button onClick={cancel} disabled={busy !== null} className="px-2 text-[13px] font-semibold text-[#5d6874] hover:text-[#121821]">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {!past && (
                    <button onClick={generate} disabled={busy !== null} className={btnPrimary}>
                      <Spark /> {busy === "generate" ? "Generating…" : "Generate"}
                    </button>
                  )}
                  {pieces.length > 0 && (
                    <Link href={`/studio?items=${ids.join(",")}`} className={btnSecondary}>
                      Try On
                    </Link>
                  )}
                </>
              )}
              {note && <p className="w-full text-[12.5px] text-[#5d6874]">{note}</p>}
            </div>
          </section>

          {/* My Closet: tap a piece to add it (or to replace the one chosen). */}
          <section ref={closetRef} aria-label="My Closet" className="flex min-h-0 scroll-mt-2 flex-col max-md:border-t max-md:border-black/[0.06]">
            <ClosetPicker closet={closet} chosen={chosen} onPick={pick} palette={palette} tab={tab} onTab={setTab} />
          </section>
        </div>
      </div>
    </div>
  );
}
