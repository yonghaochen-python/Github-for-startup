"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { ClothingItem, Outfit } from "@/components/OutfitCard";
import { SavedPhotoImage, SavedPhotoSetup, uploadSavedPhoto } from "@/components/SavedPhoto";
import { ShareArrowButton, ShareTray } from "@/components/ShareLooks";
import { SaveToggle } from "@/components/SaveToggle";
import { useToast } from "@/components/Toast";
import { MirrorIcon, PlusIcon, SearchIcon } from "@/components/Icons";
import { EmptyState, ErrorNote, PageShell, btnPrimary } from "@/components/ui";
import { requestTryOn, type TryOnResult } from "@/lib/tryOnClient";
import { Tips, type Tip } from "@/components/Tips";

const STUDIO_TIPS: Tip[] = [
  { target: '[data-tip="studio-theme"]', text: "Type a theme for outfit ideas, or pick clothes yourself." },
  { target: '[data-tip="studio-closet"]', text: "Tap to add. Tap again to take it off." },
  { target: '[data-tip="studio-tryon"]', text: "Try it on. The bookmark saves the look." },
  { target: '.site-nav a[href="/closet"], .site-tabbar a[href="/closet"]', text: "Add more clothes any time in My Closet." },
];

/** The closet tabs, in the order people dress. */
const TABS = [
  { value: "top", label: "Tops" },
  { value: "bottom", label: "Bottoms" },
  { value: "dress", label: "Dresses" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessories" },
];

const MAX_THEME = 120;
const MAX_ACCESSORIES = 3;

const STATUS_STEPS = ["Getting your outfit ready…", "Creating your try-on…", "Usually takes 10–20 seconds…", "Almost done…"];

/** The outfit the pieces belong to on the server, once there is one. */
type Look = { outfitId: string | null; occasion: string | null; isFavorite: boolean; tryOn: string | null; savedIds: string[] };

const EMPTY_LOOK: Look = { outfitId: null, occasion: null, isFavorite: false, tryOn: null, savedIds: [] };

const lookFrom = (outfit: Outfit): Look => ({
  outfitId: outfit.id,
  occasion: outfit.occasion,
  isFavorite: outfit.isFavorite,
  tryOn: outfit.tryOn ?? null,
  savedIds: outfit.layers.flatMap((l) => l.items).map((i) => i.id),
});

/** Adds a piece to the look: it takes the place of the piece in the same slot (accessories stack, up to three). */
function withPiece(pieces: ClothingItem[], item: ClothingItem): ClothingItem[] {
  const role = item.layeringRole;
  const kept = pieces.filter((p) => {
    if (role === "accessory") return true;
    if (p.layeringRole === role) return false;
    // A one-piece and a bottom don't go together.
    if (role === "one_piece" && p.layeringRole === "bottom") return false;
    if (role === "bottom" && p.layeringRole === "one_piece") return false;
    return true;
  });
  const accessories = kept.filter((p) => p.layeringRole === "accessory");
  const trimmed = role === "accessory" && accessories.length >= MAX_ACCESSORIES ? kept.filter((p) => p.id !== accessories[0].id) : kept;
  return [...trimmed, item];
}

/**
 * The Studio: the person's photo (or their try-on) on one side and their closet on the other. Type a theme to have
 * the stylist fill the look, or tap pieces to swap them in and out, then try it on and save it.
 */
export default function StudioPage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasPhoto = Boolean(user?.photoVersion);

  const [closet, setCloset] = useState<ClothingItem[] | null>(null);
  const [pieces, setPieces] = useState<ClothingItem[]>([]);
  const [look, setLook] = useState<Look>(EMPTY_LOOK);
  // Which look to start from: the one asked for, else the latest try-on.
  const [startId] = useState(() => searchParams.get("outfit") || user?.look?.outfitId || null);
  const [loadingLook, setLoadingLook] = useState(Boolean(startId));
  const [tab, setTab] = useState(TABS[0].value);

  const [theme, setTheme] = useState("");
  const [styling, setStyling] = useState(false);
  const [ideas, setIdeas] = useState<Outfit[]>([]);

  const [liveProvider, setLiveProvider] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [trying, setTrying] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPhoto, setChangingPhoto] = useState(searchParams.get("change") === "1");
  /** A photo chosen in the photo step but not saved yet; Try On saves it first. */
  const [chosenPhoto, setChosenPhoto] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Arriving from a "Try On" button (?start=1) starts the try-on right away; a refresh or Back does not.
  const autoStart = useRef(searchParams.get("start") === "1");
  const mirrorRef = useRef<HTMLDivElement | null>(null);

  const pieceIds = useMemo(() => new Set(pieces.map((p) => p.id)), [pieces]);
  const changed = look.outfitId === null || pieces.length !== look.savedIds.length || look.savedIds.some((id) => !pieceIds.has(id));

  function showOutfit(outfit: Outfit) {
    setPieces(outfit.layers.flatMap((l) => l.items));
    setLook(lookFrom(outfit));
    setResult(null);
  }

  // The closet, the try-on settings, and the starting look.
  useEffect(() => {
    let ignore = false;
    fetch("/api/closet/items")
      .then(async (res) => (res.ok ? (((await res.json()) as { items?: ClothingItem[] }).items ?? []) : []))
      .then((items) => !ignore && setCloset(items))
      .catch(() => !ignore && setCloset([]));
    fetch("/api/config")
      .then((res) => res.json() as Promise<{ tryOnLive?: boolean }>)
      .then((data) => !ignore && setLiveProvider(Boolean(data.tryOnLive)))
      .catch(() => {})
      .finally(() => !ignore && setConfigLoaded(true));
    if (startId) {
      fetch(`/api/outfits/${startId}`)
        .then(async (res) => (res.ok ? ((await res.json()) as { outfit: Outfit }).outfit : null))
        .then((outfit) => {
          if (!ignore && outfit) showOutfit(outfit);
        })
        .catch(() => {})
        .finally(() => !ignore && setLoadingLook(false));
    }
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per visit
  }, []);

  // Step through friendly status messages while the image is being generated.
  useEffect(() => {
    if (!trying) return;
    const timer = setInterval(() => setStatusIndex((i) => Math.min(i + 1, STATUS_STEPS.length - 1)), 4500);
    return () => clearInterval(timer);
  }, [trying]);

  function pick(item: ClothingItem) {
    setPieces((current) => (current.some((p) => p.id === item.id) ? current.filter((p) => p.id !== item.id) : withPiece(current, item)));
    setResult(null);
  }

  /** Makes sure the server has an outfit with exactly these pieces, and returns its id. */
  async function saveOutfit(): Promise<string> {
    if (!changed && look.outfitId) return look.outfitId;
    const itemIds = pieces.map((p) => p.id);
    const res = look.outfitId
      ? await fetch(`/api/outfits/${look.outfitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds }),
        })
      : await fetch("/api/outfits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds, occasion: look.occasion ?? undefined }),
        });
    const data = (await res.json().catch(() => ({}))) as { outfit?: Outfit; error?: string };
    if (!res.ok || !data.outfit) throw new Error(data.error ?? "Couldn't save this outfit right now.");
    const saved = data.outfit;
    setLook(lookFrom(saved));
    setIdeas((list) => list.map((o) => (o.id === saved.id ? saved : o)));
    return saved.id;
  }

  /** Brings the picture into view (on phones it sits above the Try On button), so the change is seen as it happens. */
  function showMirror() {
    const el = mirrorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const navBottom = 84;
    if (r.top >= navBottom && r.bottom <= window.innerHeight) return;
    window.scrollTo({ top: Math.max(0, window.scrollY + r.top - navBottom), behavior: "smooth" });
  }

  /** After a new photo is saved, the old try-ons (made from the old photo) stop showing until the next Try On. */
  function photoSaved() {
    setChangingPhoto(false);
    setChosenPhoto(null);
    setResult(null);
    setLook((l) => ({ ...l, tryOn: null }));
  }

  async function tryOn() {
    if (pieces.length === 0 || (!hasPhoto && !chosenPhoto) || trying) return;
    setError(null);
    setStatusIndex(0);
    setTrying(true);
    try {
      // A photo picked but not saved yet is the one they mean: save it, then dress it.
      if (chosenPhoto && (changingPhoto || !hasPhoto)) {
        await uploadSavedPhoto(chosenPhoto);
        await refreshUser();
        photoSaved();
      } else if (changingPhoto) {
        setChangingPhoto(false);
      }
      requestAnimationFrame(showMirror);
      const outfitId = await saveOutfit();
      setStatusIndex(1);
      setResult(await requestTryOn(outfitId, pieces, liveProvider));
      // The new picture is now this look's try-on and the person's current look across the app.
      refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't run the try-on right now.");
    } finally {
      setTrying(false);
    }
  }

  // One click on "Try On" elsewhere is enough: once the look, settings and photo are ready, generate.
  useEffect(() => {
    if (!autoStart.current || loadingLook || !configLoaded || !hasPhoto || pieces.length === 0) return;
    autoStart.current = false;
    router.replace(`${pathname}?outfit=${look.outfitId ?? ""}`, { scroll: false });
    tryOn();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once when everything it needs is ready
  }, [loadingLook, configLoaded, hasPhoto, pieces.length]);

  async function toggleSaved() {
    if (pieces.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const outfitId = await saveOutfit();
      const isFavorite = changed ? true : !look.isFavorite;
      const res = await fetch(`/api/outfits/${outfitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      if (!res.ok) throw new Error();
      setLook((l) => ({ ...l, isFavorite }));
      showToast(isFavorite ? "Saved" : "Unsaved");
    } catch {
      setError("Couldn't update this look. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function styleTheme(e?: React.FormEvent) {
    e?.preventDefault();
    if (styling) return;
    setError(null);
    setStyling(true);
    try {
      const typed = theme.trim();
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: typed || undefined, occasion: typed ? undefined : "Everyday" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; outfits?: Outfit[] };
      if (!res.ok || !data.outfits?.length) throw new Error(data.error ?? "Couldn't style that right now.");
      setIdeas(data.outfits);
      showOutfit(data.outfits[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't style that right now.");
    } finally {
      setStyling(false);
    }
  }

  function startOver() {
    setPieces([]);
    setLook(EMPTY_LOOK);
    setResult(null);
    setIdeas([]);
  }

  const tabItems = (closet ?? []).filter((item) => item.category === tab);
  const countIn = (value: string) => pieces.filter((p) => p.category === value).length;

  // What the big picture shows: a fresh try-on, this look's saved try-on, or the person's own photo.
  const picture =
    !changed && result?.imageDataUrl
      ? result.imageDataUrl
      : !changed && look.tryOn && look.outfitId
        ? `/api/outfits/${look.outfitId}/try-on/image?v=${look.tryOn}`
        : null;

  if (closet && closet.length === 0) {
    return (
      <main className="flex-1 pb-16">
        <PageShell className="pt-10">
          <EmptyState
            title="Add a few pieces first"
            body="Your closet is empty. Add clothes to start styling."
            action={
              <Link href="/closet?add=1" className={btnPrimary}>
                <PlusIcon className="h-4 w-4" /> Add Clothes
              </Link>
            }
          />
        </PageShell>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-16">
      <PageShell className="pt-6 sm:pt-8">
        <h1 className="sr-only">Studio</h1>
        <Tips id="studio" tips={STUDIO_TIPS} />

        <form onSubmit={styleTheme} data-tip="studio-theme" className="mb-5 flex items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
          <SearchIcon className="h-[18px] w-[18px] shrink-0 text-[#5d6874]" />
          <label htmlFor="studio-theme" className="sr-only">
            Theme
          </label>
          <input
            id="studio-theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value.slice(0, MAX_THEME))}
            placeholder="Type a theme: old money, rainy day in Paris, first date…"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] text-[#121821] outline-none placeholder:text-[#8a96a1]"
          />
          <button type="submit" disabled={styling} className={`${btnPrimary} shrink-0`}>
            {styling ? "Styling…" : "Style it"}
          </button>
        </form>

        {error && (
          <div className="mb-5">
            <ErrorNote message={error} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
          {/* The mirror: photo or try-on, the look's pieces, and what to do with them. */}
          <section aria-label="Your look" className="min-w-0 overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
            {changingPhoto || !hasPhoto ? (
              <div className="p-4 sm:p-6">
                <SavedPhotoSetup
                  onSaved={photoSaved}
                  onCancel={
                    hasPhoto
                      ? () => {
                          setChangingPhoto(false);
                          setChosenPhoto(null);
                        }
                      : undefined
                  }
                  onPendingChange={setChosenPhoto}
                />
              </div>
            ) : (
              <div ref={mirrorRef} className="relative mx-auto aspect-[3/4] max-h-[640px] w-full bg-[#f4f5f6] lg:aspect-auto lg:h-[min(620px,calc(100vh-430px))] lg:min-h-[360px]">
                {picture ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, owner-only image
                  <img src={picture} alt="You wearing this look" className="absolute inset-0 h-full w-full object-contain" />
                ) : (
                  <SavedPhotoImage className="absolute inset-0 h-full w-full object-contain" />
                )}
                {trying && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#121821]/35 backdrop-blur-[1px]">
                    <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                    <span className="rounded-full bg-[#121821]/80 px-4 py-1.5 text-[12px] text-white">{STATUS_STEPS[statusIndex]}</span>
                  </div>
                )}
                {!picture && !trying && pieces.length > 0 && (
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#4f5b66]">
                    Press Try On to see it on you
                  </span>
                )}
                {!changed && result?.isMock && (
                  <span className="absolute left-4 top-4 rounded-full bg-[#121821]/90 px-3 py-1 text-[10px] font-bold tracking-[1.4px] text-white">
                    PREVIEW (AI NOT CONNECTED)
                  </span>
                )}
                <button
                  onClick={() => setChangingPhoto(true)}
                  className="absolute bottom-4 right-4 rounded-full bg-white/90 px-3.5 py-1.5 text-[12px] font-semibold text-[#121821] shadow-sm hover:bg-white"
                >
                  Change photo
                </button>
                {/* Share arrow: adds this tried-on look to the "to share" list (open another outfit to add that one too). */}
                {picture && !trying && look.outfitId && (
                  <ShareArrowButton
                    className="absolute right-4 top-4"
                    look={{
                      id: look.outfitId,
                      v: look.tryOn ?? String(result?.imageDataUrl?.length ?? 1),
                      label: look.occasion?.trim() || `${pieces.length}-piece look`,
                    }}
                  />
                )}
              </div>
            )}

            <div className="border-t border-black/[0.06] p-4 sm:p-5">
              <ShareTray />
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-[#121821]">
                  {look.occasion ? <span className="capitalize">{look.occasion}</span> : "Your look"}
                  <span className="ml-2 font-normal text-[#5d6874]">
                    {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
                  </span>
                </p>
                {ideas.length > 1 && (
                  <div className="ml-auto flex items-center gap-1.5" aria-label="Outfit ideas">
                    {ideas.map((idea, i) => {
                      const active = idea.id === look.outfitId;
                      return (
                        <button
                          key={idea.id}
                          onClick={() => showOutfit(idea)}
                          aria-pressed={active}
                          aria-label={`Idea ${i + 1}`}
                          className={`btn-tactile h-8 w-8 rounded-full text-[12px] font-semibold ${
                            active ? "bg-[#121821] text-white" : "bg-white text-[#4f5b66] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:text-[#121821]"
                          }`}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                )}
                {pieces.length > 0 && (
                  <button onClick={startOver} className="text-[12px] font-semibold text-[#5d6874] underline-offset-4 hover:text-[#121821] hover:underline">
                    Start over
                  </button>
                )}
              </div>

              {loadingLook ? (
                <div className="h-20 animate-pulse rounded-[14px] bg-[#f4f5f6]" />
              ) : pieces.length === 0 ? (
                <p className="rounded-[14px] bg-[#f4f5f6] px-4 py-5 text-[13px] text-[#4f5b66]">Type a theme above, or pick pieces from your closet.</p>
              ) : (
                <ul className="flex gap-2 overflow-x-auto pb-1">
                  {pieces.map((piece) => (
                    <li key={piece.id} className="relative shrink-0">
                      <button
                        onClick={() => setTab(piece.category)}
                        title={piece.description}
                        className="relative block h-20 w-20 overflow-hidden rounded-[14px] bg-[#f4f5f6] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.06)]"
                      >
                        <Image src={piece.imageUrl} alt={piece.description} fill unoptimized className="object-cover" />
                      </button>
                      <button
                        onClick={() => pick(piece)}
                        aria-label={`Remove ${piece.description}`}
                        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#121821] text-[13px] leading-none text-white shadow hover:bg-[#d93a2b]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div data-tip="studio-tryon" className="mt-4 flex items-center gap-3">
                <SaveToggle saved={!changed && look.isFavorite} busy={saving || pieces.length === 0} onToggle={toggleSaved} />
                <button onClick={tryOn} disabled={trying || pieces.length === 0 || (!hasPhoto && !chosenPhoto)} className={`${btnPrimary} min-h-[48px] flex-1`}>
                  <MirrorIcon className="h-4 w-4" />
                  {trying ? "Trying on…" : "Try On"}
                </button>
              </div>
            </div>
          </section>

          {/* The closet, by category. Tap to add; tap again to remove. */}
          <section aria-label="Your closet" data-tip="studio-closet" className="min-w-0 self-start overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] lg:sticky lg:top-24">
            <div role="tablist" aria-label="Closet sections" className="flex gap-1 overflow-x-auto border-b border-black/[0.06] px-3 pt-3">
              {TABS.map((t) => {
                const active = t.value === tab;
                const count = countIn(t.value);
                return (
                  <button
                    key={t.value}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.value)}
                    className={`relative shrink-0 px-2.5 pb-3 pt-1 text-[13px] ${
                      active ? "font-semibold text-[#121821] after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#121821]" : "text-[#5d6874] hover:text-[#121821]"
                    }`}
                  >
                    {t.label}
                    {count > 0 && <span className="ml-1 text-[11px] text-[#d93a2b]">•</span>}
                  </button>
                );
              })}
            </div>
            <div className="max-h-[calc(100vh-220px)] min-h-[240px] overflow-y-auto p-3 sm:p-4 lg:max-h-[calc(100vh-260px)]">
              {closet === null ? (
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="aspect-square animate-pulse rounded-[14px] bg-[#f4f5f6]" />
                  ))}
                </div>
              ) : tabItems.length === 0 ? (
                <p className="px-1 py-6 text-[13px] text-[#5d6874]">
                  Nothing here yet.{" "}
                  <Link href="/closet?add=1" className="font-semibold text-[#121821] underline-offset-4 hover:underline">
                    Add clothes
                  </Link>
                </p>
              ) : (
                <ul className="grid grid-cols-3 gap-3">
                  {tabItems.map((item) => {
                    const chosen = pieceIds.has(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => pick(item)}
                          aria-pressed={chosen}
                          title={item.description}
                          className={`group relative block aspect-square w-full overflow-hidden rounded-[14px] bg-[#f4f5f6] ${
                            chosen ? "shadow-[inset_0_0_0_2px_#121821]" : "hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.2)]"
                          }`}
                        >
                          <Image src={item.imageUrl} alt={item.description} fill unoptimized className="object-cover" />
                          {chosen && (
                            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#121821] text-white">
                              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                                <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          )}
                        </button>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#4f5b66]">{item.description}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </PageShell>
    </main>
  );
}
