"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { retryImage } from "@/lib/retryImage";
import { fetchWithRetry } from "@/lib/fetchRetry";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { ClothingItem, Outfit } from "@/components/OutfitCard";
import { withPiece } from "@/lib/outfitPieces";
import { SavedPhotoSetup, uploadSavedPhoto } from "@/components/SavedPhoto";
import { ShareArrowButton, ShareTray } from "@/components/ShareLooks";
import { SaveToggle } from "@/components/SaveToggle";
import { useToast } from "@/components/Toast";
import { MirrorIcon, SearchIcon } from "@/components/Icons";
import { ErrorNote, PageShell, btnPrimary, btnSecondary, mirrorFrame } from "@/components/ui";
import { OutfitFlatLay } from "@/components/OutfitFlatLay";
import { NumberedPieces } from "@/components/OutfitPreview";
import { PersonPicture } from "@/components/PersonPicture";
import { OutfitPicks } from "@/components/OutfitPicks";
import { shuffleOutfit } from "@/lib/shuffleOutfit";
import { TRY_ON_CAVEAT, requestShopTryOn, requestTryOn, type TryOnResult } from "@/lib/tryOnClient";
import { LiveTryOn, type ShopPick } from "@/components/LiveTryOn";
import { CreditsLine, refreshCredits } from "@/components/Credits";
import { LIVE_SHOP_KEY, SHOP_OUTFIT_KEY, isRetiredDemo, shopPiece, type TrayItem } from "@/lib/shopCatalog";
import { readShopTryOns } from "@/lib/shopWishlist";
import { Tips, tipsSeen, type Tip } from "@/components/Tips";
import { Feedback } from "@/components/Feedback";

const SAVE_SHARE_TIPS: Tip[] = [
  { target: '[data-tip="studio-save"] button', text: "Love it? Tap the bookmark to save this look. It'll be in Saved Looks." },
  { target: '[data-tip="studio-share"]', text: "Tap the arrow to share. Pick up to 4 looks, then press Share and friends can vote." },
];

const STUDIO_TIPS: Tip[] = [
  { target: '[data-tip="studio-theme"]', text: "Type a theme for ideas, or press Style it for 3 new picks below." },
  { target: '[data-tip="studio-closet"]', text: "Tap to add. Tap again to take it off." },
  { target: '[data-tip="studio-tryon"]', text: "Try it on. The bookmark on the picture saves the look." },
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

/** The Shopping catalog as Studio pieces (only pieces whose picture works for try-on). */

const MAX_THEME = 120;

const STATUS_STEPS = ["Getting your outfit ready…", "Creating your try-on…", "Usually takes 10–20 seconds…", "Almost done…"];

/** The outfit the pieces belong to on the server, once there is one. */
/** A finished look as it was on screen, for Undo. */
type Shown = { pieces: ClothingItem[]; look: Look; result: TryOnResult | null };
const UNDO_KEY = "virm-studio-undo";

type Look = { outfitId: string | null; occasion: string | null; isFavorite: boolean; tryOn: string | null; savedIds: string[] };

const EMPTY_LOOK: Look = { outfitId: null, occasion: null, isFavorite: false, tryOn: null, savedIds: [] };

/** The last Style it ideas (their outfit ids), so they're still the top picks on the next visit. */
const PICKS_KEY = "virm-studio-picks";

const sameIds = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Free picks made on the device from the closet (not saved outfits; ids start with "pick-"). */
function freePicks(closet: ClothingItem[]): Outfit[] {
  const picks: Outfit[] = [];
  const seen = new Set<string>();
  for (let tries = 0; picks.length < 3 && tries < 12; tries++) {
    const items = shuffleOutfit(closet, []);
    const key = items.map((i) => i.id).sort().join();
    if (items.length < 2 || seen.has(key)) continue;
    seen.add(key);
    picks.push({ id: `pick-${tries}-${key}`, rationale: "", isFavorite: false, occasion: null, layers: items.map((i) => ({ role: i.layeringRole, items: [i] })) });
  }
  return picks;
}

const lookFrom = (outfit: Outfit): Look => ({
  outfitId: outfit.id,
  occasion: outfit.occasion,
  isFavorite: outfit.isFavorite,
  tryOn: outfit.tryOn ?? null,
  savedIds: outfit.layers.flatMap((l) => l.items).map((i) => i.id),
});


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
  // Arriving from Shopping (?shop=1): its picks are worn to start with and kept in a "Shop picks" tab.
  const fromShop = searchParams.get("shop") === "1";
  // Photo (try-on on the saved photo) or Live (the camera mirror); either way it's the same look.
  const [mode, setModeState] = useState<"photo" | "live">(searchParams.get("mode") === "live" ? "live" : "photo");
  const [shopPicks, setShopPicks] = useState<ShopPick[]>([]);
  // The person's shopping try-ons (pieces added from other stores, kept on this device), after Your outfit.
  const [shopTryOns, setShopTryOns] = useState<ShopPick[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage, read after the first render
    setShopTryOns(readShopTryOns().filter((t) => t.category !== "outfit").map(shopPiece) as ShopPick[]);
  }, []);
  // The panel beside the mirror: your own closet, or the Shopping catalog (plus picks brought from Shopping).
  const [source, setSource] = useState<"closet" | "shop">(fromShop ? "shop" : "closet");
  // A photo try-on of a look with Shopping pieces: not a saved outfit, so it's kept here only, for those pieces.
  const [shopTry, setShopTry] = useState<{ key: string; result: TryOnResult } | null>(null);

  const [closet, setCloset] = useState<ClothingItem[] | null>(null);
  // The closet couldn't load (a connection hiccup): say so with Try again, never show it as empty.
  const [closetFailed, setClosetFailed] = useState(false);

  function loadCloset(stale: () => boolean = () => false) {
    setClosetFailed(false);
    fetchWithRetry("/api/closet/items")
      .then(async (res) => {
        if (!res.ok) throw new Error("closet");
        return ((await res.json()) as { items?: ClothingItem[] }).items ?? [];
      })
      .then((items) => !stale() && setCloset(items))
      .catch(() => !stale() && setClosetFailed(true));
  }

  // Try again by itself when the connection comes back.
  useEffect(() => {
    if (!closetFailed) return;
    const retry = () => loadCloset();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [closetFailed]);
  const [pieces, setPieces] = useState<ClothingItem[]>([]);
  const [look, setLook] = useState<Look>(EMPTY_LOOK);
  // Which look to start from: the one asked for, else the latest try-on.
  // A look sent from the AI Stylist (?items=id,id,…): those closet pieces are worn to start with.
  const [startItems] = useState(() => (fromShop ? [] : (searchParams.get("items") ?? "").split(",").filter(Boolean).slice(0, 8)));
  const [startId] = useState(() => (fromShop || startItems.length ? null : searchParams.get("outfit") || user?.look?.outfitId || null));
  const [loadingLook, setLoadingLook] = useState(Boolean(startId));
  const [tab, setTab] = useState(TABS[0].value);

  const [theme, setTheme] = useState("");
  const [styling, setStyling] = useState(false);
  const [ideas, setIdeas] = useState<Outfit[]>([]);
  // The ideas came from a search made before (same search, same closet): shown free, with New ideas to ask again.
  const [ideasSaved, setIdeasSaved] = useState(false);
  // When there are no Style it ideas: three free outfits from the closet, shown as the top picks.
  const [shuffled, setShuffled] = useState<Outfit[]>([]);

  const [liveProvider, setLiveProvider] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [trying, setTrying] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPhoto, setChangingPhoto] = useState(searchParams.get("change") === "1");
  // No full-body photo: Studio shows the outfit itself; the photo setup opens only if they ask to try it on.
  const [addingPhoto, setAddingPhoto] = useState(false);
  const outfitOnly = !hasPhoto && !addingPhoto && !changingPhoto;
  /** A photo chosen in the photo step but not saved yet; Try On saves it first. */
  const [chosenPhoto, setChosenPhoto] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Arriving from a "Try On" button (?start=1) starts the try-on right away; a refresh or Back does not.
  const autoStart = useRef(searchParams.get("start") === "1");
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const pieceIds = useMemo(() => new Set(pieces.map((p) => p.id)), [pieces]);
  const changed = look.outfitId === null || pieces.length !== look.savedIds.length || look.savedIds.some((id) => !pieceIds.has(id));

  // Undo: the finished looks shown before this one (pieces, outfit and picture), newest last.
  // Kept for this browser tab, so a reload or a trip to another page doesn't lose it. Pictures aren't kept here:
  // each outfit's try-on is stored with the outfit, so a look comes back with its picture from there.
  const [history, setHistoryState] = useState<Shown[]>([]);
  useEffect(() => {
    try {
      const kept = JSON.parse(sessionStorage.getItem(UNDO_KEY) ?? "[]") as Shown[];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only storage, read after the first render
      if (Array.isArray(kept)) setHistoryState(kept);
    } catch {}
  }, []);
  function setHistory(update: (list: Shown[]) => Shown[]) {
    setHistoryState((list) => {
      const next = update(list);
      try {
        sessionStorage.setItem(UNDO_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  const shownRef = useRef<Shown | null>(null);
  useEffect(() => {
    if (!changed && look.outfitId) shownRef.current = { pieces, look, result };
  }, [changed, look, pieces, result]);

  /** A look for the Undo list: its picture is the outfit's stored try-on, so the large in-page picture isn't kept. */
  const slim = (shown: Shown): Shown => ({
    pieces: shown.pieces,
    look: { ...shown.look, tryOn: shown.look.tryOn ?? (shown.result?.imageDataUrl ? `r${shown.result.imageDataUrl.length}` : null) },
    result: null,
  });

  /** Adds a look to the Undo list (not twice in a row), keeping the last 20. */
  function pushShown(shown: Shown) {
    setHistory((list) => (list[list.length - 1]?.look.outfitId === shown.look.outfitId ? list : [...list.slice(-19), slim(shown)]));
  }

  /** Remembers the look on screen before moving to another one (unless it's the same outfit). */
  function rememberShown(nextOutfitId: string | null) {
    const shown = shownRef.current;
    if (shown?.look.outfitId && shown.look.outfitId !== nextOutfitId) pushShown(shown);
  }

  // Steps that would show the look already on screen are skipped (e.g. after a reload opened that same look).
  const undoSteps = history.filter((h) => h.look.outfitId !== look.outfitId || changed);

  /** Back to the previous look, with its picture (already made, so free). */
  function undo() {
    const previous = undoSteps[undoSteps.length - 1];
    if (!previous) return;
    setHistory((list) => list.slice(0, list.lastIndexOf(previous)));
    shownRef.current = previous;
    setPieces(previous.pieces);
    setLook(previous.look);
    setResult(previous.result);
  }

  function showOutfit(outfit: Outfit) {
    rememberShown(outfit.id);
    setPieces(outfit.layers.flatMap((l) => l.items));
    setLook(lookFrom(outfit));
    setResult(null);
  }

  // The top picks once the closet is in: last visit's Style it ideas if they're all still there, else free ones.
  useEffect(() => {
    if (!closet || ideas.length || shuffled.length) return;
    let ignore = false;
    let ids: string[] = [];
    try {
      ids = JSON.parse(localStorage.getItem(PICKS_KEY) ?? "[]");
    } catch {}
    Promise.all(
      (Array.isArray(ids) ? ids.slice(0, 3) : []).map((id) =>
        fetch(`/api/outfits/${encodeURIComponent(String(id))}`).then(async (res) => (res.ok ? ((await res.json()) as { outfit: Outfit }).outfit : null))
      )
    )
      .catch((): (Outfit | null)[] => [])
      .then((found: (Outfit | null)[]) => {
        if (ignore) return;
        const kept: Outfit[] = found.filter((o): o is Outfit => Boolean(o));
        if (kept.length && kept.length === ids.length) setIdeas(kept);
        else setShuffled(freePicks(closet));
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the closet first loads
  }, [closet]);

  // The closet, the try-on settings, and the starting look.
  useEffect(() => {
    let ignore = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the closet once per visit
    loadCloset(() => ignore);
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

  // Wear that look once the closet has loaded.
  const wornStart = useRef(false);
  useEffect(() => {
    if (wornStart.current || !closet || !startItems.length) return;
    wornStart.current = true;
    const chosen = startItems.flatMap((id) => closet.find((item) => item.id === id) ?? []);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- applied once, after the closet loads
    if (chosen.length) setPieces(chosen.reduce<ClothingItem[]>((worn, piece) => withPiece(worn, piece), []));
  }, [closet, startItems]);

  // Shopping's "Your outfit" (kept on this device) is listed first in the Shop panel on every visit. Arriving from
  // Shopping (?shop=1), the pieces sent over are also worn to start with.
  useEffect(() => {
    let outfit: ShopPick[] = [];
    let sent: ShopPick[] = [];
    try {
      const kept = JSON.parse(localStorage.getItem(SHOP_OUTFIT_KEY) ?? "[]") as TrayItem[];
      if (Array.isArray(kept)) outfit = kept.filter((x) => x && typeof x.key === "string" && typeof x.imageUrl === "string" && !isRetiredDemo(x.key)).map(shopPiece);
    } catch {}
    if (fromShop) {
      try {
        const picks = JSON.parse(sessionStorage.getItem(LIVE_SHOP_KEY) ?? "[]") as ShopPick[];
        if (Array.isArray(picks)) sent = picks.filter((p) => !isRetiredDemo(p.id));
      } catch {}
    }
    const all = [...outfit, ...sent.filter((p) => !outfit.some((o) => o.id === p.id))];
    /* eslint-disable react-hooks/set-state-in-effect -- browser-only storage, read after the first render */
    setShopPicks(all);
    if (sent.length) {
      // Wear one of each kind to start (the first picked); the others are a tap away in "Your outfit".
      setPieces([...sent].reverse().reduce<ClothingItem[]>((worn, piece) => withPiece(worn, piece), []));
    }
    if (all.length) setTab("picks");
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit
  }, []);

  function setMode(next: "photo" | "live") {
    setModeState(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "live") params.set("mode", "live");
    else params.delete("mode");
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  const hasShopPieces = pieces.some((p) => p.id.startsWith("shop-"));
  const piecesKey = pieces.map((p) => p.id).join(",");

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
    // A new combination is always a new outfit: the one before keeps its pieces and try-on, so Undo (and sharing
    // both as A and B) can go back to it. A saved look is never changed from here.
    const res = await fetch("/api/outfits", {
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

  /** Runs the try-on. A picture already made of this photo and these pieces comes back free unless fresh is asked for. */
  async function tryOn(fresh = false) {
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
      if (hasShopPieces) {
        setStatusIndex(1);
        const result = await requestShopTryOn(
          pieces.map((p) => ({ imageUrl: p.imageUrl, description: p.description, color: (p as ShopPick).color, layeringRole: p.layeringRole }))
        );
        setShopTry({ key: piecesKey, result });
        return;
      }
      const before = shownRef.current;
      const outfitId = await saveOutfit();
      setStatusIndex(1);
      setResult(await requestTryOn(outfitId, pieces, liveProvider, fresh));
      if (before?.look.outfitId && before.look.outfitId !== outfitId) pushShown(before);
      // The new picture is now this look's try-on and the person's current look across the app.
      refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't run the try-on right now.");
    } finally {
      setTrying(false);
      refreshCredits();
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

  async function styleTheme(e?: React.FormEvent, fresh = false) {
    e?.preventDefault();
    if (styling) return;
    // Nothing typed: three new free picks from the closet, made on the device (instant, unlimited).
    if (!theme.trim() && !fresh) return shuffle();
    setError(null);
    setStyling(true);
    try {
      const typed = theme.trim();
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: typed || undefined, occasion: typed ? undefined : "Everyday", fresh }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; outfits?: Outfit[]; saved?: boolean };
      if (!res.ok || !data.outfits?.length) throw new Error(data.error ?? "Couldn't style that right now.");
      setIdeasSaved(Boolean(data.saved));
      setIdeas(data.outfits);
      try {
        localStorage.setItem(PICKS_KEY, JSON.stringify(data.outfits.slice(0, 3).map((o) => o.id)));
      } catch {}
      document.querySelector('[aria-label="Top picks"]')?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't style that right now.");
    } finally {
      setStyling(false);
    }
  }

  /** Style it with no theme: three new free picks from the closet, made on the device (instant, unlimited). */
  function shuffle() {
    if (!closet?.length) return setError("Add a few pieces to your closet first.");
    const next = freePicks(closet);
    if (!next.length) return setError("Add a few more pieces to make outfits.");
    setError(null);
    setIdeas([]);
    setShuffled(next);
    try {
      localStorage.removeItem(PICKS_KEY);
    } catch {}
    requestAnimationFrame(() => document.querySelector('[aria-label="Top picks"]')?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  function startOver() {
    setLastPicture(null);
    rememberShown(null);
    setPieces([]);
    setLook(EMPTY_LOOK);
    setResult(null);
  }

  const tabs = source === "shop" && shopPicks.length ? [{ value: "picks", label: "Your outfit" }, ...TABS] : TABS;
  const activeTab = tabs.some((t) => t.value === tab) ? tab : tabs[0].value;
  const isShopPiece = (p: ClothingItem) => p.id.startsWith("shop-");
  const tabItems: ClothingItem[] =
    source === "shop"
      ? activeTab === "picks"
        ? shopPicks
        : // Your outfit's pieces of this kind first, then the rest of your shopping try-ons.
          [...shopPicks.filter((p) => p.category === activeTab), ...shopTryOns.filter((c) => c.category === activeTab && !shopPicks.some((p) => p.id === c.id))]
      : (closet ?? []).filter((item) => item.category === activeTab);
  const countIn = (value: string) =>
    source === "shop"
      ? value === "picks"
        ? pieces.filter((p) => shopPicks.some((s) => s.id === p.id)).length
        : pieces.filter((p) => isShopPiece(p) && p.category === value).length
      : pieces.filter((p) => !isShopPiece(p) && p.category === value).length;
  const shopShown = hasShopPieces && shopTry?.key === piecesKey ? shopTry.result : null;

  // What the big picture shows: a fresh try-on, this look's saved try-on, or the person's own photo.
  const picture = hasShopPieces
    ? (shopShown?.imageDataUrl ?? null)
    : !changed && result?.imageDataUrl
      ? result.imageDataUrl
      : !changed && look.tryOn && look.outfitId
        ? `/api/outfits/${look.outfitId}/try-on/image?v=${look.tryOn}`
        : null;
  // The last try-on picture shown: kept on screen (faded) while the look is being changed, instead of jumping back to
  // the plain photo. Cleared with a new photo or Start over.
  const [lastPicture, setLastPicture] = useState<string | null>(null);
  useEffect(() => {
    if (picture) setLastPicture(picture);
  }, [picture]);
  const stalePicture = !picture && changed && pieces.length > 0 && hasPhoto && !trying ? lastPicture : null;

  // A piece added or taken away: if this exact combination was tried on before, show that picture again (free).
  const checkedCombos = useRef(new Set<string>());
  useEffect(() => {
    if (!changed || !hasPhoto || trying || hasShopPieces || pieces.length === 0 || mode !== "photo") return;
    if (checkedCombos.current.has(piecesKey)) return;
    const timer = setTimeout(async () => {
      checkedCombos.current.add(piecesKey);
      const res = await fetch("/api/closet/tryon-remembered", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pieceIds: pieces.map((p) => p.id) }),
      }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { remembered?: boolean } | null;
      // Remembered pictures are shown again without the AI and without a credit.
      if (data?.remembered) tryOn();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the combination changes
  }, [piecesKey, changed, hasPhoto, mode]);

  // The try-on on show right now (made in this visit), for its Good / Bad feedback.
  const shownTryOnId = !picture ? undefined : hasShopPieces ? shopShown?.requestId : !changed ? result?.requestId : undefined;

  // On wider screens the picks sit beside the photo in the mirror; otherwise (phones, Live, no photo) below it.
  const sidePicks = mode !== "live" && !outfitOnly && !changingPhoto && hasPhoto;
  // The top 3 picks: the last Style it ideas, or three free outfits (Style it with no theme makes new ones).
  const picksProps = {
    picks: ideas.length ? ideas : shuffled,
    activeId: ideas.length ? look.outfitId : (shuffled.find((p) => sameIds(p.layers.flatMap((l) => l.items).map((i) => i.id), pieces.map((i) => i.id)))?.id ?? null),
    title: ideas.length ? "Top picks for you" : "Picks from your closet",
    note:
      ideas.length && ideasSaved ? (
        <button onClick={() => styleTheme(undefined, true)} disabled={styling} className="text-[12px] font-semibold text-[#121821] underline underline-offset-4">
          {styling ? "Styling…" : "New ideas"}
        </button>
      ) : null,
    onPick: (pick: Outfit) => {
      if (pick.id.startsWith("pick-")) {
        rememberShown(null);
        setPieces(pick.layers.flatMap((l) => l.items));
        setLook(EMPTY_LOOK);
        setResult(null);
      } else showOutfit(pick);
      showMirror();
    },
  };

  return (
    <main className="flex-1 pb-16">
      <PageShell className="max-w-[1440px]! pt-6 sm:pt-8">
        <h1 className="sr-only">Studio</h1>
        <Tips id="studio" tips={STUDIO_TIPS} />
        {/* Save and Share only appear once there's a look, so their tips wait for it (shown once, like the others). */}
        {pieces.length > 0 && !trying && (picture || outfitOnly) && tipsSeen("studio") && (
          <Tips id="studio-save-share" tips={SAVE_SHARE_TIPS} delay={1200} />
        )}

        {/* One row above the mirror (so it can be bigger): Photo | Live, the theme box, and the way back to Shopping. */}
        <div className="mb-4 flex flex-wrap items-center gap-3 lg:flex-nowrap">
          <div role="tablist" aria-label="How to try it on" className="relative grid shrink-0 grid-cols-2 rounded-full bg-white p-1 shadow-[0_1px_0_rgba(18,24,33,0.03),0_8px_22px_rgba(18,30,45,0.06)]">
            {/* The dark pill slides to the chosen side. */}
            <span
              aria-hidden
              className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#121821] transition-transform duration-300 ease-[cubic-bezier(.3,.7,.2,1)] motion-reduce:transition-none ${
                mode === "live" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            {(["photo", "live"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`relative rounded-full px-5 py-2 text-[13px] font-semibold transition-colors duration-300 ${mode === m ? "text-white" : "text-[#4f5b66] hover:text-[#121821]"}`}
              >
                {m === "photo" ? "Photo" : "Live"}
              </button>
            ))}
          </div>
          {fromShop && (
            <Link href="/shop" className="ml-auto shrink-0 text-[12.5px] font-semibold text-[#29343a] underline-offset-4 hover:underline lg:order-last">
              ← Back to Shopping
            </Link>
          )}
        <form onSubmit={styleTheme} data-tip="studio-theme" className="flex w-full min-w-0 items-center gap-2 rounded-full lg:w-auto lg:flex-1 bg-white p-1.5 pl-5 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
          <SearchIcon className="h-[18px] w-[18px] shrink-0 text-[#5d6874]" />
          <label htmlFor="studio-theme" className="sr-only">
            Theme
          </label>
          <input
            id="studio-theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value.slice(0, MAX_THEME))}
            placeholder="Type a theme (old money, first date…) or leave empty for new picks"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] text-[#121821] outline-none placeholder:text-[#8a96a1]"
          />
          <button type="submit" disabled={styling} className={`${btnPrimary} shrink-0`}>
            {styling ? "Styling…" : "Style it"}
          </button>
        </form>
        </div>

        {error && (
          <div className="mb-5">
            <ErrorNote message={error} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,430px)]">
          {/* The mirror: Live (the camera) or Photo (the saved photo or its try-on), in the same frame. */}
          {mode === "live" ? (
            <LiveTryOn outfit={pieces} picks={pieces.filter((p) => p.id.startsWith("shop-")) as ShopPick[]} />
          ) : (
          <section aria-label="Your look" className="min-w-0 self-start overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
            {outfitOnly ? (
              <div className={`${mirrorFrame} bg-[#f1ede7]`}>
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#4f5b66]">Your outfit</span>
                <OutfitFlatLay pieces={pieces} emptyText="Tap a pick below, press Style it for new ones, or pick pieces from your closet." />
                {pieces.length > 0 && !hasShopPieces && (
                  <div data-tip="studio-save" className="absolute right-4 top-4">
                    <SaveToggle
                      saved={!changed && look.isFavorite}
                      busy={saving}
                      onToggle={toggleSaved}
                      className={`h-11 w-11 ${!changed && look.isFavorite ? "" : "!bg-white/90 !shadow-sm hover:!bg-white"}`}
                    />
                  </div>
                )}
              </div>
            ) : changingPhoto || !hasPhoto ? (
              <div className="p-4 sm:p-6">
                <SavedPhotoSetup
                  onSaved={photoSaved}
                  onCancel={
                    hasPhoto
                      ? () => {
                          setChangingPhoto(false);
                          setChosenPhoto(null);
                        }
                      : () => {
                          setAddingPhoto(false);
                          setChosenPhoto(null);
                        }
                  }
                  onPendingChange={setChosenPhoto}
                />
              </div>
            ) : (
              <div
                ref={mirrorRef}
                className={`${mirrorFrame} grid bg-white ${
                  pieces.length
                    ? "grid-cols-[minmax(88px,24%)_minmax(0,1fr)] md:grid-cols-[minmax(88px,18%)_minmax(0,1fr)_minmax(150px,26%)]"
                    : "grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(150px,26%)]"
                }`}
              >
                {/* The look's pieces numbered down the left, the person head to toe, and (on wider screens) the top 3 picks. */}
                {pieces.length > 0 && <NumberedPieces pieces={pieces} max={5} className="justify-center border-r border-black/[0.07] px-3 py-6 sm:px-4 sm:py-8 [&>li]:max-h-[150px]" />}
                <div className="flex min-h-0 min-w-0 justify-center">
                <div className="relative h-full min-w-[160px] max-w-full">
                {picture ? (
                  <PersonPicture src={picture} alt="You wearing this look" className="block h-full w-auto max-w-full object-contain" />
                ) : stalePicture ? (
                  // The look was changed: the last try-on stays (faded) until the picture is updated.
                  <PersonPicture src={stalePicture} alt="Your previous try-on" className="block h-full w-auto max-w-full object-contain opacity-55" />
                ) : user?.photoVersion ? (
                  <PersonPicture src={`/api/me/photo?v=${user.photoVersion}`} alt="Your saved try-on photo" className="block h-full w-auto max-w-full object-contain" />
                ) : null}
                {trying && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#121821]/35 backdrop-blur-[1px]">
                    <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                    <span className="rounded-full bg-[#121821]/80 px-4 py-1.5 text-[12px] text-white">{STATUS_STEPS[statusIndex]}</span>
                  </div>
                )}
                {!picture && !trying && pieces.length > 0 && !stalePicture && (
                  <span className="absolute bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#4f5b66]">
                    Press Try On to see it on you
                  </span>
                )}
                {stalePicture && (
                  <span className="absolute bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-2 rounded-full bg-white/95 py-1 pl-3 pr-1 text-[11px] font-semibold text-[#4f5b66] shadow-sm">
                    Look changed
                    <button
                      onClick={() => tryOn()}
                      className="rounded-full bg-[#121821] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#2a3542]"
                      title="Make a picture of the look as it is now (uses a photo try-on)"
                    >
                      Update picture
                    </button>
                  </span>
                )}
                {!changed && result?.reused && !trying && (
                  <span className="absolute bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-2 rounded-full bg-white/90 py-1 pl-3 pr-1 text-[11px] font-semibold text-[#4f5b66] shadow-sm">
                    Saved try-on
                    <button
                      onClick={() => tryOn(true)}
                      className="rounded-full bg-[#121821] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#2a3542]"
                      title="Make a new picture of this look (uses a try-on)"
                    >
                      Redo
                    </button>
                  </span>
                )}
                {((!changed && result?.isMock) || shopShown?.isMock) && (
                  <span className="absolute bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#121821]/90 px-3 py-1 text-[10px] font-bold tracking-[1.4px] text-white">
                    PREVIEW (AI NOT CONNECTED)
                  </span>
                )}
                <button
                  onClick={() => setChangingPhoto(true)}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3.5 py-1.5 text-[12px] font-semibold text-[#121821] shadow-sm hover:bg-white"
                >
                  Change photo
                </button>
                {/* Top right: Save, the share arrow (adds this tried-on look to the "to share" list), and Undo. */}
                {!trying && (
                  <div className="absolute right-3 top-3 flex flex-col gap-2">
                    {pieces.length > 0 && !hasShopPieces && (
                      <span data-tip="studio-save" className="contents">
                        <SaveToggle
                          saved={!changed && look.isFavorite}
                          busy={saving}
                          onToggle={toggleSaved}
                          className={`h-11 w-11 ${!changed && look.isFavorite ? "" : "!bg-white/90 !shadow-sm hover:!bg-white"}`}
                        />
                      </span>
                    )}
                    {picture && look.outfitId && (
                      <ShareArrowButton
                        data-tip="studio-share"
                        look={{
                          id: look.outfitId,
                          v: look.tryOn ?? String(result?.imageDataUrl?.length ?? 1),
                          label: look.occasion?.trim() || `${pieces.length}-piece look`,
                        }}
                      />
                    )}
                    <button
                      onClick={undo}
                      disabled={undoSteps.length === 0}
                      aria-label="Undo: back to the previous outfit"
                      title={undoSteps.length ? "Back to the previous outfit" : "Nothing to undo yet"}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#121821] shadow-sm hover:bg-white disabled:opacity-40 disabled:hover:bg-white/90"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                        <path d="M9 14 4 9l5-5" />
                        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                      </svg>
                    </button>
                  </div>
                )}
                </div>
                </div>
                <OutfitPicks {...picksProps} layout="column" className="hidden min-h-0 border-l border-black/[0.07] p-3 md:flex" />
              </div>
            )}

            <div className="border-t border-black/[0.06] p-4 sm:p-5">
              <ShareTray />
              {outfitOnly ? (
                // No photo: the outfit is the result. Trying it on is there for anyone who changes their mind.
                <div className="flex flex-col items-center gap-2">
                  <button onClick={() => setAddingPhoto(true)} className={`${btnSecondary} min-h-[48px] w-full`}>
                    <MirrorIcon className="h-4 w-4" /> Add a photo to try it on
                  </button>
                  <p className="text-center text-[11.5px] text-[#5d6874]">Outfit ideas are free. A try-on on your photo uses 1 photo credit.</p>
                </div>
              ) : (
              <div data-tip="studio-tryon" className="flex items-center gap-3">
                <button onClick={() => tryOn()} disabled={trying || pieces.length === 0 || (!hasPhoto && !chosenPhoto)} className={`${btnPrimary} min-h-[48px] flex-1`}>
                  <MirrorIcon className="h-4 w-4" />
                  {trying ? "Trying on…" : "Try On"}
                </button>
              </div>
              )}
              <Feedback kind="photo" targetId={shownTryOnId} className="mt-3 justify-center" />
              {!outfitOnly && <CreditsLine kind="photo" />}
              {hasShopPieces && (
                <p className="mt-2 text-center text-[11.5px] text-[#5d6874]">Looks with Shopping pieces aren&apos;t saved: the picture shows here only.</p>
              )}
              {!outfitOnly && <p className="mt-2 text-center text-[11.5px] leading-snug text-[#5d6874]">{TRY_ON_CAVEAT}</p>}
            </div>
          </section>
          )}

          <div className="flex min-w-0 flex-col gap-4 self-start lg:sticky lg:top-24">
            {/* The pieces in this look, above the closet. */}
            <section aria-label="Pieces in this look" className="rounded-[22px] bg-white p-4 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[#121821]">
                    {look.occasion ? <span className="capitalize">{look.occasion}</span> : "Your look"}
                    <span className="ml-2 font-normal text-[#5d6874]">
                      {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
                    </span>
                  </p>
                  {ideas.length > 1 && ideas.some((idea) => idea.id === look.outfitId) && (
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
                {ideasSaved && ideas.some((idea) => idea.id === look.outfitId) && (
                  <p className="mb-2 flex flex-wrap items-center gap-x-2 text-[12px] text-[#5d6874]">
                    Saved ideas for this search
                    <button onClick={() => styleTheme(undefined, true)} disabled={styling} className="font-semibold text-[#121821] underline underline-offset-4">
                      {styling ? "Styling…" : "New ideas"}
                    </button>
                  </p>
                )}
                {/* A Style it outfit on show: its Good / Bad feedback. */}
                {ideas.some((idea) => idea.id === look.outfitId) && <Feedback kind="outfit" targetId={look.outfitId} className="mb-3" />}

                {loadingLook ? (
                  <div className="h-20 animate-pulse rounded-[14px] bg-[#f4f5f6]" />
                ) : pieces.length === 0 ? (
                  <p className="rounded-[14px] bg-[#f4f5f6] px-4 py-5 text-[13px] text-[#4f5b66]">Tap a pick, press Style it for new ones, or pick pieces below.</p>
                ) : (
                  <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {pieces.map((piece) => (
                      <li key={piece.id} className="relative shrink-0">
                        <button
                          onClick={() => {
                            setSource(isShopPiece(piece) ? "shop" : "closet");
                            setTab(piece.category);
                          }}
                          title={piece.description}
                          className="relative block h-20 w-20 overflow-hidden rounded-[14px] bg-[#f4f5f6] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.06)]"
                        >
                          <Image src={piece.imageUrl} alt={piece.description} fill unoptimized onError={retryImage} className="object-cover" />
                          {/* Shopping pieces aren't owned: marked so they're never mistaken for closet clothes. */}
                          {piece.id.startsWith("shop-") && (
                            <span className="absolute bottom-1 left-1 rounded-full bg-white/95 px-1.5 py-[1px] text-[8.5px] font-semibold uppercase tracking-[1px] text-[#4f5b66]">
                              Shop
                            </span>
                          )}
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

            </section>

            {/* The closet, by category. Tap to add; tap again to remove. */}
            <section aria-label="Your closet" data-tip="studio-closet" className="min-w-0 overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
              <div className="flex items-center justify-between gap-3 px-4 pt-4">
                <div className="inline-flex rounded-full bg-[#f1f3f4] p-1">
                  {(["closet", "shop"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSource(s);
                        // Opening Shop starts on "Your outfit" when there's something in it.
                        if (s === "shop" && shopPicks.length) setTab("picks");
                      }}
                      aria-pressed={source === s}
                      className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition ${source === s ? "bg-white text-[#121821] shadow-sm" : "text-[#5d6874] hover:text-[#121821]"}`}
                    >
                      {s === "closet" ? "My closet" : "Shop"}
                    </button>
                  ))}
                </div>
                {source === "shop" && (
                  <Link href="/shop" className="text-[12px] font-semibold text-[#4f5b66] underline-offset-4 hover:text-[#121821] hover:underline">
                    Browse Shopping →
                  </Link>
                )}
              </div>
              <div role="tablist" aria-label={source === "shop" ? "Shop sections" : "Closet sections"} className="flex flex-wrap border-b border-black/[0.06] px-2.5 pt-3">
                {tabs.map((t) => {
                  const active = t.value === activeTab;
                  const count = countIn(t.value);
                  return (
                    <button
                      key={t.value}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.value)}
                      className={`relative shrink-0 px-2 pb-3 pt-1 text-[13px] ${
                        active ? "font-semibold text-[#121821] after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#121821]" : "text-[#5d6874] hover:text-[#121821]"
                      }`}
                    >
                      {t.label}
                      {count > 0 && <span className="ml-1 text-[11px] text-[#d93a2b]">•</span>}
                    </button>
                  );
                })}
              </div>
              <div className="max-h-[calc(100vh-220px)] min-h-[240px] overflow-y-auto p-3 sm:p-4 lg:max-h-[calc(100vh-260px)]">
                {closetFailed && source === "closet" ? (
                  <p className="px-1 py-6 text-[13px] text-[#5d6874]">
                    Your closet didn&apos;t load. Check your connection.{" "}
                    <button onClick={() => loadCloset()} className="font-semibold text-[#121821] underline-offset-4 hover:underline">
                      Try again
                    </button>
                  </p>
                ) : closet === null && source === "closet" ? (
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="aspect-square animate-pulse rounded-[14px] bg-[#f4f5f6]" />
                    ))}
                  </div>
                ) : tabItems.length === 0 ? (
                  <p className="px-1 py-6 text-[13px] text-[#5d6874]">
                    Nothing here yet.{" "}
                    {source === "shop" ? (
                      <Link href="/shop" className="font-semibold text-[#121821] underline-offset-4 hover:underline">
                        Find pieces in Shopping
                      </Link>
                    ) : (
                      <Link href="/closet?add=1" className="font-semibold text-[#121821] underline-offset-4 hover:underline">
                        Add clothes
                      </Link>
                    )}
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
                            <Image src={item.imageUrl} alt={item.description} fill unoptimized onError={retryImage} className="object-cover" />
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
        </div>
        <div className={`mt-8 ${sidePicks ? "md:hidden" : ""}`}>
          {/* The top 3 picks, below the mirror on phones: the last Style it ideas, or three free outfits (Style it with no theme makes new ones). */}
          <OutfitPicks {...picksProps} />
        </div>
      </PageShell>
    </main>
  );
}
