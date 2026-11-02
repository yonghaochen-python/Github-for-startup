"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { CreditsLine, refreshCredits } from "@/components/Credits";
import { CameraIcon, MirrorIcon, PlusIcon } from "@/components/Icons";
import { ErrorNote, PageHeader, PageShell, btnPrimary, btnSecondary, btnText, eyebrow, surface } from "@/components/ui";
import {
  BODY_SHAPES,
  BODY_SHAPE_LABELS,
  UNDERTONES,
  type BodyShape,
  type Corrections,
  type StyleReading,
  type StyledLook,
  type StyledPiece,
  type Swatch,
  type Undertone,
} from "@/lib/styleProfile";

type Profile = {
  reading: StyleReading;
  aiReading: { undertone: Undertone; bodyShape: BodyShape };
  corrections: Corrections;
  look: StyledLook | null;
};
type ClosetItem = { id: string; imageUrl: string; category: string; description: string };

/** Longest side of the photo sent for a reading (plenty for color and proportions, and quick to send). */
const SEND_SIDE = 1280;

async function shrink(photo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  const scale = Math.min(1, SEND_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("photo"))), "image/jpeg", 0.88));
}

/** Pictures with the background removed sit whole on the card instead of filling it. */
const isCutout = (url: string) => url.startsWith("/uploads/cut-");

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Swatches({ colors }: { colors: Swatch[] }) {
  return (
    <ul className="flex flex-wrap gap-2.5">
      {colors.map((c) => (
        <li key={c.name} className="flex w-[64px] flex-col items-center gap-1 text-center">
          <span className="h-10 w-10 rounded-full shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)]" style={{ background: /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#ccc" }} />
          <span className="text-[11px] leading-tight text-[#4f5b66]">{c.name}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The Stylist: a personal style reading from one photo (undertone, colors, body shape, cuts and fabrics) and a look
 * from the person's closet that suits them. Pieces can be swapped or taken out one at a time; the look can be tried
 * on in Studio, as a photo or live.
 */
export default function StylistPage() {
  const { user } = useAuth();
  const hasSavedPhoto = Boolean(user?.photoVersion);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [closet, setCloset] = useState<ClosetItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [styling, setStyling] = useState(false);
  const [newPhoto, setNewPhoto] = useState(false);
  const [chosen, setChosen] = useState<File | null>(null);
  const [occasion, setOccasion] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/stylist")
      .then(async (res) => (res.ok ? ((await res.json()) as { profile: Profile | null }).profile : null))
      .then(setProfile)
      .catch(() => setProfile(null));
    fetch("/api/closet/items")
      .then(async (res) => (res.ok ? (((await res.json()) as { items?: ClosetItem[] }).items ?? []) : []))
      .then(setCloset)
      .catch(() => {});
  }, []);

  const preview = useMemo(() => (chosen ? URL.createObjectURL(chosen) : null), [chosen]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function readMyStyle() {
    setReading(true);
    setError(null);
    try {
      const source = chosen ?? (hasSavedPhoto ? await fetch(`/api/me/photo?v=${user!.photoVersion}`).then((r) => (r.ok ? r.blob() : null)) : null);
      if (!source) throw new Error("Choose a photo first.");
      const form = new FormData();
      form.append("photo", await shrink(source), "photo.jpg");
      form.append("requestId", crypto.randomUUID());
      const res = await fetch("/api/stylist", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { profile?: Profile; error?: string };
      if (!res.ok || !data.profile) throw new Error(data.error ?? "The stylist couldn't read that photo. Please try again.");
      setProfile(data.profile);
      setNewPhoto(false);
      setChosen(null);
      refreshCredits();
    } catch (err) {
      setError(err instanceof Error && err.message !== "photo" ? err.message : "That photo couldn't be used. Try a JPG or PNG.");
    } finally {
      setReading(false);
    }
  }

  async function patch(body: object) {
    const before = profile;
    const res = await fetch("/api/stylist", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { profile?: Profile; error?: string };
    if (res.ok && data.profile) setProfile(data.profile);
    else {
      setProfile(before);
      setError(data.error ?? "Couldn't save that change. Please try again.");
    }
  }

  function correct(next: Corrections) {
    if (!profile) return;
    patch({ corrections: { ...profile.corrections, ...next } });
  }

  /** Saves the look with one piece changed (shown straight away). */
  function changeLook(pieces: StyledPiece[]) {
    if (!profile?.look) return;
    setProfile({ ...profile, look: { ...profile.look, pieces } });
    patch({ pieces });
  }

  const swap = (piece: StyledPiece) =>
    changeLook(
      profile!.look!.pieces.map((p) =>
        p.itemId === piece.itemId ? { itemId: piece.alternates[0], why: "", alternates: [...piece.alternates.slice(1), piece.itemId] } : p
      )
    );
  const takeOut = (piece: StyledPiece) => changeLook(profile!.look!.pieces.filter((p) => p.itemId !== piece.itemId));

  async function newLook() {
    setStyling(true);
    setError(null);
    try {
      const res = await fetch("/api/stylist/look", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ occasion }) });
      const data = (await res.json().catch(() => ({}))) as { profile?: Profile; error?: string };
      if (!res.ok || !data.profile) throw new Error(data.error ?? "Couldn't style a new look. Please try again.");
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't style a new look. Please try again.");
    } finally {
      setStyling(false);
    }
  }

  async function deleteProfile() {
    if (!confirm("Delete your style reading? You can get a new one any time.")) return;
    const res = await fetch("/api/stylist", { method: "DELETE" });
    if (res.ok) setProfile(null);
    else setError("Couldn't delete it right now. Please try again.");
  }

  const itemById = new Map(closet.map((i) => [i.id, i]));
  const lookIds = profile?.look?.pieces.map((p) => p.itemId).filter((id) => itemById.has(id)) ?? [];
  const showUpload = profile === null || newPhoto;

  return (
    <main className="flex-1 pb-20">
      <PageShell>
        <PageHeader
          title="Stylist"
          description="Your colors, shape and the cuts that suit you, from one photo. Then a look from your closet."
          actions={
            profile && !newPhoto ? (
              <button onClick={() => setNewPhoto(true)} className={btnSecondary}>
                <CameraIcon className="h-4 w-4" /> New photo
              </button>
            ) : null
          }
        />

        {error && (
          <div className="mb-6">
            <ErrorNote message={error} />
          </div>
        )}

        {profile === undefined && <p className="text-[13px] text-[#5d6874]">Loading…</p>}

        {showUpload && profile !== undefined && (
          <section className={`${surface} mb-8 grid gap-8 p-6 sm:p-8 md:grid-cols-[220px_1fr]`}>
            <div className="mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-[18px] bg-[#eef1f4]">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="The photo you chose" className="h-full w-full object-cover" />
              ) : hasSavedPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/me/photo?v=${user!.photoVersion}`} alt="Your saved photo" className="h-full w-full object-cover" />
              ) : (
                <button onClick={() => fileInput.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 text-[13px] text-[#4f5b66]">
                  <PlusIcon className="h-6 w-6" /> Choose a photo
                </button>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <p className={eyebrow}>Best photo</p>
                <ul className="mt-2 space-y-1 text-[14px] text-[#4f5b66]">
                  <li>Full length, standing straight</li>
                  <li>Daylight, no filter or heavy makeup</li>
                  <li>Fitted clothes, hair away from your face</li>
                </ul>
              </div>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setChosen(e.target.files?.[0] ?? null)} />
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={readMyStyle} disabled={reading || (!chosen && !hasSavedPhoto)} className={btnPrimary}>
                  {reading ? "Reading your style…" : "Read my style"}
                </button>
                <button onClick={() => fileInput.current?.click()} className={btnText}>
                  {chosen || hasSavedPhoto ? "Use a different photo" : "Choose a photo"}
                </button>
                {newPhoto && (
                  <button onClick={() => (setNewPhoto(false), setChosen(null))} className={btnText}>
                    Cancel
                  </button>
                )}
              </div>
              <div className="max-w-md">
                <CreditsLine kind="photo" />
              </div>
              <p className="max-w-md text-[12px] leading-relaxed text-[#5d6874]">
                Uses one photo try-on. Your photo goes to our AI provider to read your coloring and proportions; Virm keeps only the written results, not
                another copy of the photo. Lighting can fool it, so you can correct anything.{" "}
                <Link href="/privacy" className="underline underline-offset-2">
                  Privacy
                </Link>
              </p>
            </div>
          </section>
        )}

        {profile && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="flex flex-col gap-6">
              {profile.reading.practice && (
                <p className="rounded-[14px] bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">Practice result: no AI was used and nothing was counted.</p>
              )}
              <section className={`${surface} p-6`}>
                <p className={eyebrow}>Your colors</p>
                <p className="mt-2 font-display text-[28px] leading-tight text-[#121821]">{profile.reading.colorSeason}</p>
                <p className="mt-1 text-[13.5px] text-[#4f5b66]">
                  {cap(profile.reading.contrast)} contrast · {profile.reading.undertoneWhy}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Undertone">
                  <span className="mr-1 text-[12px] font-semibold text-[#121821]">Undertone</span>
                  {UNDERTONES.map((u) => (
                    <button
                      key={u}
                      role="radio"
                      aria-checked={profile.reading.undertone === u}
                      onClick={() => correct({ undertone: u === profile.aiReading.undertone ? undefined : u })}
                      className={`rounded-full px-3 py-1 text-[12px] ${profile.reading.undertone === u ? "bg-[#121821] text-white" : "bg-[#eef1f4] text-[#4f5b66] hover:bg-[#e2e7ec]"}`}
                    >
                      {cap(u)}
                    </button>
                  ))}
                </div>
                <p className="mb-2 mt-5 text-[12px] font-semibold text-[#121821]">Wear near your face</p>
                <Swatches colors={profile.reading.bestColors} />
                <p className="mb-2 mt-5 text-[12px] font-semibold text-[#121821]">Go easy on</p>
                <Swatches colors={profile.reading.avoidColors} />
              </section>

              <section className={`${surface} p-6`}>
                <p className={eyebrow}>Your shape</p>
                <select
                  aria-label="Body shape"
                  value={profile.reading.bodyShape}
                  onChange={(e) => correct({ bodyShape: e.target.value === profile.aiReading.bodyShape ? undefined : (e.target.value as BodyShape) })}
                  className="mt-2 rounded-full bg-[#eef1f4] px-3 py-1.5 text-[13px] font-semibold text-[#121821]"
                >
                  {BODY_SHAPES.map((s) => (
                    <option key={s} value={s}>
                      {BODY_SHAPE_LABELS[s]}
                    </option>
                  ))}
                </select>
                <p className="mt-3 text-[14px] leading-relaxed text-[#4f5b66]">{profile.reading.bodyNotes}</p>
                <p className="mb-1.5 mt-4 text-[12px] font-semibold text-[#121821]">Cuts that suit you</p>
                <ul className="list-disc space-y-1 pl-5 text-[14px] text-[#4f5b66]">
                  {profile.reading.fits.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <p className="mb-1.5 mt-4 text-[12px] font-semibold text-[#121821]">Fabrics</p>
                <p className="text-[14px] text-[#4f5b66]">{profile.reading.materials.join(" · ")}</p>
                <p className="mt-3 text-[14px] text-[#4f5b66]">{profile.reading.patterns}</p>
              </section>

              <section className="px-1">
                <p className="text-[14px] leading-relaxed text-[#4f5b66]">{profile.reading.summary}</p>
                {profile.reading.shoppingIdeas.length > 0 && (
                  <p className="mt-3 text-[13px] text-[#4f5b66]">
                    <span className="font-semibold text-[#121821]">Worth adding: </span>
                    {profile.reading.shoppingIdeas.join(" · ")}
                  </p>
                )}
                <button onClick={deleteProfile} className={`${btnText} mt-2 text-[#5d6874]`}>
                  Delete my style reading
                </button>
              </section>
            </div>

            <section className={`${surface} h-fit p-6`}>
              <p className={eyebrow}>Your look{profile.look?.occasion ? ` · ${profile.look.occasion}` : ""}</p>
              {profile.look && lookIds.length > 0 ? (
                <>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#4f5b66]">{profile.look.rationale}</p>
                  <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {profile.look.pieces.map((piece) => {
                      const item = itemById.get(piece.itemId);
                      if (!item) return null;
                      return (
                        <li key={piece.itemId} className="group relative flex flex-col rounded-[16px] bg-[#f4f6f8] p-2">
                          <div className="relative aspect-square overflow-hidden rounded-[12px] bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.imageUrl} alt={item.description} className={`h-full w-full ${isCutout(item.imageUrl) ? "object-contain p-2" : "object-cover"}`} />
                            <div className="absolute right-1.5 top-1.5 flex gap-1">
                              {piece.alternates.length > 0 && (
                                <button
                                  onClick={() => swap(piece)}
                                  aria-label={`Swap ${item.description} for another`}
                                  title="Swap"
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[14px] shadow hover:bg-white"
                                >
                                  ↻
                                </button>
                              )}
                              <button
                                onClick={() => takeOut(piece)}
                                aria-label={`Take out ${item.description}`}
                                title="Take out"
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[13px] shadow hover:bg-white"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <p className="mt-2 line-clamp-2 px-1 text-[12px] font-semibold leading-snug text-[#121821]">{item.description}</p>
                          {piece.why && <p className="mt-1 px-1 text-[11.5px] leading-snug text-[#5d6874]">{piece.why}</p>}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href={`/studio/mirror?items=${lookIds.join(",")}`} className={btnPrimary}>
                      Try it on
                    </Link>
                    <Link href={`/studio/mirror?items=${lookIds.join(",")}&mode=live`} className={btnSecondary}>
                      <MirrorIcon className="h-4 w-4" /> See it live
                    </Link>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-[14px] text-[#4f5b66]">
                  {closet.length < 2 ? (
                    <>
                      Add a few pieces to your closet and the stylist will put a look together.{" "}
                      <Link href="/closet?add=1" className="font-semibold text-[#121821] underline-offset-4 hover:underline">
                        Add clothes
                      </Link>
                    </>
                  ) : (
                    "No look yet. Ask for one below."
                  )}
                </p>
              )}
              {closet.length >= 2 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    newLook();
                  }}
                  className="mt-6 flex gap-2 border-t border-[#eef1f4] pt-5"
                >
                  <input
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                    maxLength={80}
                    placeholder="Occasion (optional): dinner, office, weekend…"
                    className="min-w-0 flex-1 rounded-full bg-[#f4f6f8] px-4 text-[13px] outline-none focus:ring-2 focus:ring-[#121821]/20"
                  />
                  <button type="submit" disabled={styling} className={`${btnSecondary} shrink-0`}>
                    {styling ? "Styling…" : "New look"}
                  </button>
                </form>
              )}
            </section>
          </div>
        )}
      </PageShell>
    </main>
  );
}
