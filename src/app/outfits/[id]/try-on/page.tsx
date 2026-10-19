"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LAYER_LABELS, type LayeringRole } from "@/lib/layering";
import { InlineLoading } from "@/components/InlineLoading";
import { useAuth } from "@/components/AuthProvider";
import { CurrentLookBar, MirrorImage, SavedPhotoImage, SavedPhotoSetup, useTakeOffLook } from "@/components/SavedPhoto";
import { useToast } from "@/components/Toast";
import { BookmarkIcon, CheckIcon, MirrorIcon } from "@/components/Icons";
import { ErrorNote, PageHeader, PageShell, btnPrimary, btnSecondary, btnText, eyebrow } from "@/components/ui";
import { garmentSheetJpeg, photoToJpeg } from "@/lib/clientImage";

type OutfitItem = { id: string; imageUrl: string; description: string; layeringRole: LayeringRole };
type OutfitLayer = { role: LayeringRole; items: OutfitItem[] };
type Outfit = { id: string; isFavorite: boolean; occasion: string | null; style: string | null; layers: OutfitLayer[] };
type NotShown = { role: LayeringRole; description: string; reason: string };
type TryOnResult = { isMock: boolean; provider: string; imageDataUrl: string | null; layers: OutfitLayer[]; notShown?: NotShown[] };

type Stage = "ready" | "generating" | "result";

const STATUS_STEPS = [
  "Getting your outfit ready…",
  "Creating your try-on…",
  "Usually takes 10–20 seconds…",
  "Almost done…",
];

const photoFrame = "relative mx-auto aspect-[3/4] w-full max-w-[260px] sm:max-w-[420px] overflow-hidden border border-[#d9dfdf] bg-[#eef2f3]";

/**
 * Try-on for one outfit. The outfit comes from the URL (so "Try On" anywhere opens it already selected) and the
 * person's saved photo is reused automatically: the server reads it privately, nothing is re-uploaded.
 */
export default function TryOnPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const takeOffLook = useTakeOffLook();
  const hasPhoto = Boolean(user?.photoVersion);
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [stage, setStage] = useState<Stage>("ready");
  const [changingPhoto, setChangingPhoto] = useState(false);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [liveProvider, setLiveProvider] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  // Arriving from a "Try On" button (?start=1) starts the try-on right away; a refresh or Back does not.
  const autoStart = useRef(searchParams.get("start") === "1");
  const [statusIndex, setStatusIndex] = useState(0);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/outfits/${params.id}`)
      .then(async (res) => {
        if (ignore) return;
        if (res.status === 404 || res.status === 401) return setLoadState("missing");
        if (!res.ok) throw new Error("load");
        const data = (await res.json()) as { outfit: Outfit };
        if (ignore) return;
        setOutfit(data.outfit);
        setLoadState("ready");
      })
      .catch(() => {
        if (!ignore) setLoadState("error");
      });
    fetch("/api/config")
      .then((res) => res.json() as Promise<{ tryOnLive?: boolean }>)
      .then((data) => !ignore && setLiveProvider(Boolean(data.tryOnLive)))
      .catch(() => {})
      .finally(() => !ignore && setConfigLoaded(true));
    return () => {
      ignore = true;
    };
  }, [params.id]);

  // Step through friendly status messages while the image is being generated.
  useEffect(() => {
    if (stage !== "generating") return;
    const timer = setInterval(() => setStatusIndex((i) => Math.min(i + 1, STATUS_STEPS.length - 1)), 4500);
    return () => clearInterval(timer);
  }, [stage]);

  async function generate() {
    if (!outfit || !hasPhoto) return;
    setError(null);
    setStatusIndex(0);
    setStage("generating");
    try {
      // No photo is attached: the server uses the saved try-on photo.
      const formData = new FormData();
      if (liveProvider) {
        // A real try-on needs each garment's photo; shrink them here so phones upload small files.
        const items = outfit.layers.flatMap((layer) => layer.items);
        const photos = await Promise.allSettled(
          items.map(async (item) => {
            const res = await fetch(item.imageUrl);
            if (!res.ok) throw new Error("garment");
            return photoToJpeg(await res.blob(), 0.88, 1024);
          })
        );
        photos.forEach((p, i) => {
          if (p.status === "fulfilled") formData.append(`garment:${items[i].id}`, p.value, `${items[i].id}.jpg`);
        });
        // Providers that dress a whole outfit in one call use every piece on a single sheet.
        if (photos.every((p) => p.status === "fulfilled")) {
          const sheet = await garmentSheetJpeg(photos.map((p) => (p as PromiseFulfilledResult<Blob>).value)).catch(() => null);
          if (sheet) formData.append("garmentSheet", sheet, "garments.jpg");
        }
      }
      setStatusIndex(1);
      const res = await fetch(`/api/outfits/${outfit.id}/try-on`, { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { error?: string; result?: TryOnResult };
      if (!res.ok || !data.result) throw new Error(data.error ?? "Couldn't run the try-on right now.");
      setResult(data.result);
      setStage("result");
      // The new result is now the current look shown on the photo across the app.
      refreshUser();
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't run the try-on right now.");
      setStage("ready");
    }
  }

  // One click on "Try On" is enough: once the outfit, settings and saved photo are ready, generate.
  useEffect(() => {
    if (!autoStart.current || loadState !== "ready" || !configLoaded || !hasPhoto || changingPhoto) return;
    autoStart.current = false;
    router.replace(pathname, { scroll: false });
    // Already wearing this outfit: show it instead of paying for the same try-on again.
    if (user?.look?.outfitId === params.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starting the try-on the person asked for
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once when everything it needs is ready
  }, [loadState, configLoaded, hasPhoto, changingPhoto]);

  async function saveLook() {
    if (!outfit || outfit.isFavorite) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/outfits/${outfit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: true }),
      });
      if (!res.ok) throw new Error("save");
      setOutfit((prev) => (prev ? { ...prev, isFavorite: true } : prev));
      showToast("Saved to your looks");
    } catch {
      setError("Couldn't save this look. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function startChangingPhoto() {
    setChangingPhoto(true);
    setResult(null);
    setStage("ready");
  }

  if (loadState === "loading") {
    return (
      <main className="flex-1">
        <InlineLoading label="Loading your outfit…" />
      </main>
    );
  }

  if (loadState !== "ready" || !outfit) {
    return (
      <main className="flex-1 pb-16">
        <PageShell>
          <PageHeader
            title="Outfit not available"
            description={loadState === "error" ? "Couldn't load this outfit. Please try again." : "This outfit doesn't exist anymore."}
            actions={<Link href="/try-on" className={btnPrimary}>Choose Another Outfit</Link>}
          />
        </PageShell>
      </main>
    );
  }

  const items = outfit.layers.flatMap((layer) => layer.items);
  const outfitName = [outfit.style, outfit.occasion].filter(Boolean).join(" · ") || "Your outfit";
  const needsPhoto = !hasPhoto || changingPhoto;
  // The current look is this outfit: show it right away (until the person changes it).
  const wearingThis = !needsPhoto && stage === "ready" && user?.look?.outfitId === outfit.id;

  return (
    <main className="flex-1 pb-16">
      <PageShell>
        <PageHeader
          back={{ href: `/outfits/${outfit.id}`, label: "Back to outfit details" }}
          title={stage === "result" || wearingThis ? "Your try-on" : "Try this outfit on"}
          description={
            changingPhoto
              ? "Choose a new full-body photo. It replaces your current one."
              : needsPhoto
              ? "Save a full-body photo first. You only do this once."
              : stage === "generating"
                ? "Creating your try-on…"
              : stage === "result" || wearingThis
                ? "Here's the look on you."
                : "Ready to try on."
          }
        />

        {error && (
          <div className="mb-6 max-w-2xl">
            <ErrorNote message={error} />
          </div>
        )}

        {needsPhoto ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <SavedPhotoSetup
              onSaved={() => setChangingPhoto(false)}
              onCancel={hasPhoto ? () => setChangingPhoto(false) : undefined}
            />
            <SelectedOutfit name={outfitName} items={items} note="This outfit stays selected." />
          </div>
        ) : (stage === "result" && result) || wearingThis ? (
          <div ref={resultRef} className="grid scroll-mt-24 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
            <div>
              <div className={`${photoFrame} max-w-[340px] sm:max-w-[520px]`}>
                {result?.imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result.imageDataUrl} alt="You wearing this outfit" className="h-full w-full object-contain" />
                ) : wearingThis ? (
                  <MirrorImage className="h-full w-full object-contain" />
                ) : (
                  <SavedPhotoImage className="h-full w-full object-contain" />
                )}
                {result?.isMock && (
                  <span className="absolute left-3 top-3 bg-[#1c2328]/90 px-3 py-1.5 text-[9px] font-bold tracking-[1.6px] text-white">
                    PROTOTYPE PREVIEW
                  </span>
                )}
              </div>
              <p className="mx-auto mt-3 max-w-[520px] text-[11.5px] leading-relaxed text-[#7e888e]">
                {result?.isMock
                  ? "The AI try-on isn't connected here, so this shows your photo, not a generated image of you wearing the pieces."
                  : "Preview only. Fit and details may differ from the real clothes."}
                {result?.notShown && result.notShown.length > 0 && (
                  <> Not shown: {result.notShown.map((n) => n.description).join(", ")}.</>
                )}
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <div className="flex flex-col gap-3">
                <button onClick={saveLook} disabled={saving || outfit.isFavorite} className={`${btnPrimary} w-full`}>
                  {outfit.isFavorite ? (
                    <><CheckIcon className="h-4 w-4" /> Look Saved</>
                  ) : (
                    <><BookmarkIcon className="h-4 w-4" /> {saving ? "Saving…" : "Save Look"}</>
                  )}
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/try-on" className={btnSecondary}>Try Another Outfit</Link>
                  <button onClick={startChangingPhoto} className={btnSecondary}>Change My Photo</button>
                </div>
                <div className="flex flex-wrap items-center gap-x-5">
                  <Link href="/outfits" className={btnText}>Back to Outfits</Link>
                  <button onClick={generate} className={btnText}>Generate Again</button>
                  <button
                    onClick={async () => {
                      if (await takeOffLook()) {
                        setResult(null);
                        setStage("ready");
                      }
                    }}
                    className={btnText}
                  >
                    Take Off Look
                  </button>
                </div>
                <p className="text-[11.5px] text-[#7e888e]">
                  This stays on your photo until you change it.
                </p>
              </div>
              <SelectedOutfit name={outfitName} items={items} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:gap-10">
              <section aria-labelledby="your-photo" className="min-w-0">
                <p id="your-photo" className={`${eyebrow} mb-3`}>Your Photo</p>
                <div className={photoFrame}>
                  <MirrorImage className="h-full w-full object-cover object-top" />
                  {stage === "generating" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1c2328]/35 backdrop-blur-[1px]">
                      <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                    </div>
                  )}
                </div>
                {user?.look && (
                  <div className="mx-auto mt-3 max-w-[260px] sm:max-w-[420px]">
                    <CurrentLookBar />
                    <p className="mt-1 text-[11px] text-[#7e888e]">The new try-on starts from your original photo.</p>
                  </div>
                )}
                <div className="mx-auto mt-3 flex max-w-[260px] items-center sm:max-w-[420px] justify-between gap-3">
                  <span className="text-[11.5px] text-[#7e888e]">{user?.look ? "Your current look" : "Your saved try-on photo"}</span>
                  <button onClick={startChangingPhoto} disabled={stage === "generating"} className="text-[12px] font-semibold text-[#26313a] underline-offset-4 hover:underline disabled:opacity-50">
                    Change My Photo
                  </button>
                </div>
              </section>
              <SelectedOutfit name={outfitName} items={items} label="Selected Outfit" showChange={stage !== "generating"} />
            </div>

            <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 -mx-5 mt-8 border-t border-[#d9dfdf] bg-[#f6f9fa]/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
              <div className="flex flex-col items-start gap-3 md:flex-row md:items-center">
                <button onClick={generate} disabled={stage === "generating"} className={`${btnPrimary} min-h-[52px] w-full px-8 text-[13.5px] md:w-auto`}>
                  <MirrorIcon className="h-4 w-4" />
                  {stage === "generating" ? "Generating…" : "Generate Try-On"}
                </button>
                <p role="status" aria-live="polite" className="text-[12.5px] text-[#5f6a70]">
                  {stage === "generating" ? STATUS_STEPS[statusIndex] : "Uses your saved photo."}
                </p>
              </div>
            </div>
          </>
        )}
      </PageShell>
    </main>
  );
}

function SelectedOutfit({
  name,
  items,
  label = "Selected Outfit",
  note,
  showChange = true,
}: {
  name: string;
  items: OutfitItem[];
  label?: string;
  note?: string;
  showChange?: boolean;
}) {
  return (
    <section aria-label={label} className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className={eyebrow}>{label}</p>
        {showChange && (
          <Link href="/try-on" className="text-[12px] font-semibold text-[#26313a] underline-offset-4 hover:underline">
            Change outfit
          </Link>
        )}
      </div>
      <div className="border border-[#d9dfdf] bg-white">
        <p className="border-b border-[#e5eaec] px-4 py-3 text-[12.5px] font-semibold capitalize text-[#1c2328]">
          {name} · {items.length} {items.length === 1 ? "piece" : "pieces"}
        </p>
        <ul>
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3.5 border-b border-[#eef1f2] px-4 py-2.5 last:border-b-0">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-[#f3f5f5]">
                <Image src={item.imageUrl} alt="" fill className="object-cover" unoptimized />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[#1c2328]">{item.description}</p>
                <span className="text-[11px] text-[#8b969c]">{LAYER_LABELS[item.layeringRole]}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {note && <p className="mt-3 text-[11.5px] text-[#7e888e]">{note}</p>}
    </section>
  );
}
