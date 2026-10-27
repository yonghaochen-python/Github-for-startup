import Image from "next/image";
import { Pricing } from "@/components/Pricing";
import { PageShell, eyebrow } from "@/components/ui";

// A quiet strip of Virm's own product photos beside the headline (no try-on results are shown or implied).
const STRIP = [
  { src: "/sample/camel-coat.jpg", alt: "Camel coat" },
  { src: "/sample/cable-sweater.jpg", alt: "Cable-knit sweater" },
  { src: "/sample/plaid-skirt.jpg", alt: "Pleated plaid skirt" },
  { src: "/sample/chelsea-boots.jpg", alt: "Chelsea boots" },
];

/** Planned pricing, shown for feedback. Display only: nothing can be bought here yet. */
export default function PricingPage() {
  return (
    <main className="flex-1 pb-20">
      <PageShell>
        <header className="grid gap-8 pb-10 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-end">
          <div>
            <p className={eyebrow}>Plans</p>
            <h1 className="mt-3 font-display text-[48px] font-normal leading-[0.95] tracking-[-1.6px] text-[#121821] sm:text-[72px]">
              Choose your <em>mirror</em>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#4f5b66]">
              Start free with your own closet. Upgrade for more photo try-ons, more live sessions and, soon, styling that&apos;s personal to you.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2" aria-hidden>
            {STRIP.map((p) => (
              <div key={p.src} className="relative aspect-[3/4] overflow-hidden bg-[#f0eee9]">
                <Image src={p.src} alt={p.alt} fill unoptimized className="p-2" style={{ objectFit: "contain" }} />
              </div>
            ))}
          </div>
        </header>
        <Pricing />
      </PageShell>
    </main>
  );
}
