"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GUEST_LOOKS, GUEST_MODEL_PHOTO, type GuestPiece } from "@/lib/guestLooks";
import { LAYER_LABELS, type LayeringRole } from "@/lib/layering";
import { PageShell, btnPrimary, btnSecondary } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { Dialog } from "@/components/Dialog";

/**
 * The free demo: Studio's mirror with a demo model and the starter closet. Pick a look, or tap a piece to see every
 * look made with it. Every picture was made in advance, so this uses no AI, no account and no storage, and nothing is
 * saved. Saving, your own photo and your own clothes invite the visitor to create an account.
 */

const ORDER = ["outer_layer", "mid_layer", "base_layer", "one_piece", "bottom", "shoes", "accessory"];
const sorted = (items: GuestPiece[]) => [...items].sort((a, b) => ORDER.indexOf(a.layeringRole) - ORDER.indexOf(b.layeringRole));
const shortName = (d: string) => d.split(/[,;(]/)[0].trim();

/** Every piece the demo looks use, once each (tops first). */
const PIECES: GuestPiece[] = sorted([...new Map(GUEST_LOOKS.flatMap((l) => l.items).map((i) => [i.imageUrl, i])).values()]);

type Invite = "save" | "photo" | "closet";
const INVITES: Record<Invite, string> = {
  save: "Save this look",
  photo: "Try looks on your own photo",
  closet: "Build your own closet",
};

export default function TryFreePage() {
  const [slug, setSlug] = useState<string>(GUEST_LOOKS[0].slug);
  const [piece, setPiece] = useState<string | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  // Signed in already: the account buttons go to the real thing instead of inviting.
  const signedIn = useAuth().status === "signedIn";
  const REAL: Record<Invite, string> = { save: "/studio", photo: "/studio", closet: "/closet?add=1" };
  const look = GUEST_LOOKS.find((l) => l.slug === slug) ?? GUEST_LOOKS[0];
  const looks = useMemo(() => (piece ? GUEST_LOOKS.filter((l) => l.items.some((i) => i.imageUrl === piece)) : GUEST_LOOKS), [piece]);

  // A random first look once in the browser (server and browser start the same).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a random start is only possible in the browser
    setSlug(GUEST_LOOKS[Math.floor(Math.random() * GUEST_LOOKS.length)].slug);
  }, []);

  function pickPiece(imageUrl: string) {
    const next = piece === imageUrl ? null : imageUrl;
    setPiece(next);
    // Show a look with that piece straight away (the one on screen if it already has it).
    if (next && !look.items.some((i) => i.imageUrl === next)) {
      const first = GUEST_LOOKS.find((l) => l.items.some((i) => i.imageUrl === next));
      if (first) setSlug(first.slug);
    }
  }

  return (
    <main className="flex-1 pb-16">
      <PageShell className="pt-6 sm:pt-8">
        <div className="mb-5 flex items-center gap-3">
          <h1 className="font-display text-[40px] font-normal leading-none tracking-[-1px] text-[#121821] sm:text-[52px]">Try it free</h1>
          <span className="rounded-full bg-[#121821] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[1.6px] text-white">Demo</span>
          <Link href={signedIn ? "/studio" : "/login?create=1"} className={`${btnPrimary} ml-auto hidden sm:inline-flex`}>
            {signedIn ? "Open Studio" : "Create Account"}
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
          {/* The mirror: the look's pieces numbered on the left, the demo model wearing it on the right. */}
          <section aria-label="The look on the demo model" className="min-w-0 self-start overflow-hidden rounded-[22px] bg-white shadow-[0_30px_80px_rgba(18,30,45,0.12)] ring-1 ring-black/[0.04] lg:sticky lg:top-24">
            <div className="grid h-[min(64vh,640px)] min-h-[380px] grid-cols-[minmax(84px,26%)_minmax(0,1fr)] bg-[linear-gradient(180deg,#f9f8f5_0%,#eeece7_100%)]">
              <ol className="flex flex-col justify-center gap-1 overflow-y-auto border-r border-black/[0.05] px-2 py-4 sm:px-3">
                {sorted(look.items).map((item, i) => (
                  <li key={item.imageUrl} className="animate-[piece-in_.28s_ease-out] motion-reduce:animate-none">
                    <button
                      onClick={() => pickPiece(item.imageUrl)}
                      aria-pressed={piece === item.imageUrl}
                      title={`Looks with the ${shortName(item.description).toLowerCase()}`}
                      className={`flex w-full items-center gap-2.5 rounded-[12px] p-1.5 text-left ${piece === item.imageUrl ? "bg-[#f1efeb]" : "hover:bg-[#f6f5f2]"}`}
                    >
                      <span className="w-[18px] shrink-0 self-start pt-1 text-[10px] font-bold tracking-widest text-[#29343a]">{String(i + 1).padStart(2, "0")}</span>
                      <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-[8px] bg-white md:h-[72px] md:w-[60px]">
                        <Image src={item.imageUrl} alt="" fill unoptimized className="object-cover" />
                      </span>
                      <span className="min-w-0 flex-1 max-md:hidden">
                        <span className="line-clamp-2 text-[12px] font-medium leading-snug text-[#121821]">{shortName(item.description)}</span>
                        <span className="mt-0.5 block text-[10px] uppercase tracking-[1.2px] text-[#5d6874]">{LAYER_LABELS[item.layeringRole as LayeringRole]}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="relative min-h-0">
                <Image
                  key={look.picture}
                  src={look.picture ?? GUEST_MODEL_PHOTO}
                  alt={`The demo model wearing the ${look.name} look`}
                  fill
                  unoptimized
                  priority
                  className="animate-[picture-in_.45s_ease-out] object-contain motion-reduce:animate-none"
                />
                <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[1.2px] text-[#4f5b66] backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#9aa4ad]" aria-hidden /> Demo model
                </span>
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/60 bg-white/55 px-3.5 py-1.5 text-[12px] font-semibold text-[#121821] backdrop-blur-xl">
                  {look.name}
                </span>
              </div>
            </div>
            {/* What needs an account: one tap each opens the invite. */}
            <div className="flex flex-wrap items-center gap-2 border-t border-black/[0.06] p-4">
              {(["save", "photo", "closet"] as const).map((kind, i) =>
                signedIn ? (
                  <Link key={kind} href={REAL[kind]} className={i === 0 ? btnPrimary : btnSecondary}>
                    {kind === "save" ? "Make my own look" : kind === "photo" ? "Use my photo" : "Add my clothes"}
                  </Link>
                ) : (
                  <button key={kind} onClick={() => setInvite(kind)} className={i === 0 ? btnPrimary : btnSecondary}>
                    {kind === "save" ? "Save look" : kind === "photo" ? "Use my photo" : "Add my clothes"}
                  </button>
                )
              )}
            </div>
          </section>

          <div className="flex min-w-0 flex-col gap-6">
            {/* The looks (all of them, or the ones with the chosen piece). */}
            <section aria-label="Looks">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-[13px] font-semibold text-[#121821]">
                  {piece ? `${looks.length} looks with this piece` : `${looks.length} looks`}
                </h2>
                {piece && (
                  <button onClick={() => setPiece(null)} className="text-[12.5px] font-semibold text-[#121821] underline underline-offset-4">
                    Show all
                  </button>
                )}
              </div>
              <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-3">
                {looks.map((option) => {
                  const active = option.slug === look.slug;
                  return (
                    <li key={option.slug}>
                      <button
                        onClick={() => setSlug(option.slug)}
                        aria-pressed={active}
                        aria-label={option.name}
                        className={`group relative block aspect-[3/4] w-full overflow-hidden rounded-[14px] bg-[#eceae6] ${active ? "ring-2 ring-[#121821] ring-offset-2" : ""}`}
                      >
                        <Image src={option.picture} alt="" fill unoptimized className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]" />
                        <span className="absolute inset-x-1.5 bottom-1.5 truncate rounded-full bg-white/80 px-2 py-0.5 text-center text-[10.5px] font-semibold text-[#121821] backdrop-blur">
                          {option.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* The demo closet: tap a piece to see the looks made with it. */}
            <section aria-label="Demo closet" className="rounded-[22px] bg-white p-4 shadow-[0_14px_36px_rgba(18,30,45,0.06)]">
              <h2 className="mb-3 text-[13px] font-semibold text-[#121821]">Demo closet</h2>
              <ul className="grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-5">
                {PIECES.map((item) => {
                  const active = piece === item.imageUrl;
                  return (
                    <li key={item.imageUrl}>
                      <button
                        onClick={() => pickPiece(item.imageUrl)}
                        aria-pressed={active}
                        title={shortName(item.description)}
                        aria-label={`Looks with the ${shortName(item.description).toLowerCase()}`}
                        className={`relative block aspect-square w-full overflow-hidden rounded-[10px] bg-[#f4f5f6] ${active ? "ring-2 ring-[#121821]" : "hover:ring-1 hover:ring-black/20"}`}
                      >
                        <Image src={item.imageUrl} alt="" fill unoptimized className="object-cover" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>
      </PageShell>

      {/* The invite: what an account adds, and the way in. Nothing in the demo is saved. */}
      {invite && (
        <Dialog label={INVITES[invite]} onClose={() => setInvite(null)} className="w-full max-w-[400px] rounded-[24px] bg-white p-6 shadow-[0_40px_90px_rgba(0,0,0,0.3)]">
          <p className="font-display text-[30px] leading-tight text-[#121821]">{INVITES[invite]}</p>
          <p className="mt-2 text-[14px] text-[#4f5b66]">Free with an account.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/login?create=1" className={btnPrimary}>
              Create Account
            </Link>
            <Link href="/login" className="px-2 text-[14px] font-semibold text-[#121821] underline-offset-4 hover:underline">
              Log In
            </Link>
            <button onClick={() => setInvite(null)} className="ml-auto text-[13px] font-semibold text-[#5d6874]">
              Not now
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
