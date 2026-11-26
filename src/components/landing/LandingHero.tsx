import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { ArrowRightIcon } from "@/components/Icons";
import { SAMPLE_CLOSET } from "@/lib/sampleCloset";

/**
 * The landing test pages' shared layout, the same as the live welcome page: a big headline with Try It Free and
 * Create Account on the left, the picture on the right (below on phones). Only the headline and the picture differ
 * between A and B (see lib/landingTest).
 */
export function LandingHero({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex-1 pb-20">
      <section className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-5 pb-16 pt-12 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] md:pt-16 lg:gap-16">
        <div>
          <h1 className="font-display font-normal leading-[0.95] tracking-[-2px] text-[#121821]" style={{ fontSize: "clamp(46px, 6.2vw, 96px)" }}>
            {title}
          </h1>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/try" className={`${btnPrimary} min-h-[52px] px-7 text-[15px]`}>
              Try It Free <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link href="/login?create=1" className={btnSecondary}>
              Create Account
            </Link>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

/** A starter-closet piece by its picture name (public/sample/<name>.jpg). */
export function samplePiece(name: string) {
  const item = SAMPLE_CLOSET.find((i) => i.imageUrl === `/sample/${name}.jpg`);
  if (!item) throw new Error(`Unknown starter piece: ${name}`);
  return { name, imageUrl: item.imageUrl, description: item.description.split(/[,;(]/)[0].trim() };
}

/** The small labels on the pictures: "Your store" (black, bag) and "Your closet" (brown, hanger). */
export function SourceTag({ kind }: { kind: "store" | "closet" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 self-start rounded-[4px] px-1.5 py-1 text-[8.5px] font-bold uppercase leading-tight tracking-[1px] text-white sm:whitespace-nowrap sm:px-2 sm:text-[9.5px] sm:tracking-[1.2px] ${
        kind === "store" ? "bg-[#121821]" : "bg-[#8a6a48]"
      }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-3 w-3 shrink-0 fill-none stroke-current stroke-[1.8]" strokeLinecap="round" strokeLinejoin="round">
        {kind === "store" ? (
          <>
            <path d="M6 8h12l-1 12H7L6 8Z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          </>
        ) : (
          <>
            <path d="M12 7a2 2 0 1 1 2-2c0 1-2 1.5-2 3" />
            <path d="M12 8 3 15.5c-.6.5-.3 1.5.5 1.5h17c.8 0 1.1-1 .5-1.5L12 8Z" />
          </>
        )}
      </svg>
      {kind === "store" ? "Your store" : "Your closet"}
    </span>
  );
}
