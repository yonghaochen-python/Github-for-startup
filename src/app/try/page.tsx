"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GUEST_LOOKS, GUEST_MEN_LOOKS, GUEST_MEN_PHOTO, GUEST_MODEL_PHOTO, type GuestLookWithPieces, type GuestPiece } from "@/lib/guestLooks";
import { PageShell, btnPrimary, btnSecondary } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { Dialog } from "@/components/Dialog";

/**
 * The free demo: the demo model in the middle with her closet around her (tops on the left, bottoms, shoes and the hat
 * on the right). Tap a piece to see the next look made with it, or an occasion to see a look for it (tap again for
 * another). The pieces she's wearing light up. Every picture was made in advance, so this uses no AI, no account and
 * no storage, and nothing is saved. Saving, your own photo and your own clothes invite the visitor to create an account.
 * A Women | Men switch shows the same demo on the male model (fewer looks: see GUEST_MEN_LOOKS).
 */

const shortName = (d: string) => d.split(/[,;(]/)[0].trim();

const TOP_ROLES = ["outer_layer", "mid_layer", "base_layer", "one_piece"];

type Model = "women" | "men";
type DemoSet = { looks: GuestLookWithPieces[]; photo: string; occasions: { name: string; slugs: string[] }[]; left: GuestPiece[]; right: GuestPiece[] };

/** Every piece a set's looks use, once each, split into the two sides (tops left; bottoms, shoes and hats right). */
function demoSet(looks: GuestLookWithPieces[], photo: string, occasions: DemoSet["occasions"]): DemoSet {
  const pieces = [...new Map(looks.flatMap((l) => l.items).map((i) => [i.imageUrl, i])).values()];
  return {
    looks,
    photo,
    occasions,
    left: pieces.filter((p) => TOP_ROLES.includes(p.layeringRole)),
    right: pieces.filter((p) => !TOP_ROLES.includes(p.layeringRole)),
  };
}

/** Each model's looks by occasion (every look is in exactly one). */
const SETS: Record<Model, DemoSet> = {
  women: demoSet(GUEST_LOOKS, GUEST_MODEL_PHOTO, [
    { name: "Cold days", slugs: ["snow-day", "puffer-and-jeans", "autumn-layers", "wrap-coat-plaid", "camel-and-cream", "city-coat"] },
    { name: "Work", slugs: ["office-winter", "smart-and-simple", "plaid-and-knit", "black-and-denim"] },
    { name: "Weekend", slugs: ["weekend-classic", "cozy-knit", "cafe-afternoon", "linen-and-denim", "summer-errands"] },
    { name: "Summer", slugs: ["garden-party", "easy-sundress", "beach-day", "picnic", "linen-and-chinos"] },
  ]),
  men: demoSet(GUEST_MEN_LOOKS, GUEST_MEN_PHOTO, [
    { name: "Cold days", slugs: ["men-puffer"] },
    { name: "Work", slugs: ["men-turtleneck", "men-city-coat"] },
    { name: "Weekend", slugs: ["men-cozy-knit"] },
    { name: "Summer", slugs: ["men-linen"] },
  ]),
};

type Invite = "save" | "photo" | "closet";
const INVITES: Record<Invite, string> = {
  save: "Save this look",
  photo: "Try looks on your own photo",
  closet: "Build your own closet",
};

export default function TryFreePage() {
  const [model, setModel] = useState<Model>("women");
  const set = SETS[model];
  const [slug, setSlug] = useState<string>(GUEST_LOOKS[0].slug);
  const [invite, setInvite] = useState<Invite | null>(null);
  // Signed in already: the account buttons go to the real thing instead of inviting.
  const signedIn = useAuth().status === "signedIn";
  const REAL: Record<Invite, string> = { save: "/studio", photo: "/studio", closet: "/studio?closet=1&add=1" };
  const look = set.looks.find((l) => l.slug === slug) ?? set.looks[0];
  const wearing = useMemo(() => new Set(look.items.map((i) => i.imageUrl)), [look]);
  const occasion = set.occasions.find((o) => o.slugs.includes(look.slug));

  function switchModel(next: Model) {
    setModel(next);
    setSlug(SETS[next].looks[0].slug);
  }

  // A random first look once in the browser (server and browser start the same).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a random start is only possible in the browser
    setSlug(GUEST_LOOKS[Math.floor(Math.random() * GUEST_LOOKS.length)].slug);
  }, []);

  /** The next look (after the one on screen) made with this piece. */
  function pickPiece(imageUrl: string) {
    const looks = set.looks;
    const at = looks.findIndex((l) => l.slug === look.slug);
    for (let step = 1; step <= looks.length; step++) {
      const next = looks[(at + step) % looks.length];
      if (next.items.some((i) => i.imageUrl === imageUrl)) return setSlug(next.slug);
    }
  }

  /** A look for this occasion: the next one if the look on screen is already one. */
  function pickOccasion(o: DemoSet["occasions"][number]) {
    const at = o.slugs.indexOf(look.slug);
    setSlug(o.slugs[(at + 1) % o.slugs.length]);
  }

  const rail = (pieces: GuestPiece[]) => (
    <div className="grid content-center gap-1.5 sm:grid-cols-2 sm:gap-2.5">
      {pieces.map((item) => {
        const on = wearing.has(item.imageUrl);
        return (
          <button
            key={item.imageUrl}
            onClick={() => pickPiece(item.imageUrl)}
            aria-pressed={on}
            title={shortName(item.description)}
            aria-label={`A look with the ${shortName(item.description).toLowerCase()}`}
            className={`relative block size-10 overflow-hidden rounded-[10px] bg-[#f4f2ee] transition duration-300 sm:size-14 sm:rounded-[12px] ${
              on ? "scale-105 opacity-100 ring-2 ring-[#121821] ring-offset-1" : "opacity-45 hover:opacity-80"
            }`}
          >
            <Image src={item.imageUrl} alt="" fill unoptimized className="object-cover" />
          </button>
        );
      })}
    </div>
  );

  return (
    <main className="flex-1 pb-16">
      <PageShell className="pt-6 sm:pt-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[40px] font-normal leading-none tracking-[-1px] text-[#121821] sm:text-[52px]">Try it free</h1>
          <span className="rounded-full bg-[#121821] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[1.6px] text-white">Demo</span>
          <div role="radiogroup" aria-label="Show the women's or men's demo" className="relative order-last grid w-full grid-cols-2 rounded-full bg-white p-[3px] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] sm:order-none sm:w-auto">
            <span
              aria-hidden
              className={`absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-[#121821] transition-transform duration-300 motion-reduce:transition-none ${model === "men" ? "translate-x-full" : ""}`}
            />
            {(["women", "men"] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={model === m}
                onClick={() => switchModel(m)}
                className={`relative z-10 min-h-[34px] min-w-[64px] rounded-full px-3 text-[12.5px] font-medium transition-colors ${model === m ? "text-white" : "text-[#4f5b66] hover:text-[#121821]"}`}
              >
                {m === "women" ? "Women" : "Men"}
              </button>
            ))}
          </div>
          <Link href={signedIn ? "/studio" : "/login?create=1"} className={`${btnPrimary} ml-auto hidden sm:inline-flex`}>
            {signedIn ? "Open Studio" : "Create Account"}
          </Link>
        </div>

        <section aria-label="The demo model and her closet" className="mx-auto max-w-[820px]">
          {/* Her closet around her: tap a piece for a look made with it. */}
          <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-6">
            {rail(set.left)}
            <div className="relative mx-auto aspect-[3/4] w-full max-w-[440px] overflow-hidden rounded-[20px] bg-[#eceae6] shadow-[0_30px_70px_rgba(18,30,45,0.16)]">
              <Image
                key={look.picture}
                src={look.picture ?? set.photo}
                alt={`The ${model === "men" ? "male" : "female"} demo model wearing the ${look.name} look`}
                fill
                unoptimized
                priority
                className="animate-[picture-in_.45s_ease-out] object-cover object-top motion-reduce:animate-none"
              />
              <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[1.2px] text-[#4f5b66] backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9aa4ad]" aria-hidden /> Demo model
              </span>
            </div>
            {rail(set.right)}
          </div>

          {/* Occasions: tap for a look, tap again for another. */}
          <div role="radiogroup" aria-label="Pick an occasion" className="mt-4 flex flex-wrap justify-center gap-2">
            {set.occasions.map((o) => {
              const on = o === occasion;
              return (
                <button
                  key={o.name}
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickOccasion(o)}
                  className={`min-h-[38px] rounded-full px-4 text-[13px] font-medium transition-colors ${
                    on ? "bg-[#121821] text-white" : "bg-white text-[#4f5b66] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] hover:text-[#121821]"
                  }`}
                >
                  {o.name}
                </button>
              );
            })}
          </div>

          {/* What needs an account: one tap each opens the invite. */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
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
