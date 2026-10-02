/**
 * Decorative liquid-chrome accent — the same visual family as the "Melt"
 * loading screen, used sparingly as ambient motion on the home hero rather
 * than a static gradient. Monochrome/cool so it sits quietly behind type
 * instead of competing with it.
 */
export type BlobVariant = "mercury" | "slate" | "frost";

const VARIANTS: Record<BlobVariant, string> = {
  mercury:
    "radial-gradient(circle at 38% 32%, #fff 0%, #d7dde0 22%, #7a858b 55%, #202427 85%)",
  slate:
    "radial-gradient(circle at 40% 35%, #fff 0%, #c7ccd0 24%, #5c666b 58%, #181b1d 88%)",
  frost:
    "radial-gradient(circle at 36% 30%, #fff 0%, #e2e8ea 20%, #9aa5a9 52%, #2a2f31 86%)",
};

export function HeroBlob({ variant, className = "" }: { variant: BlobVariant; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute ${className}`}>
      <div
        className="blob-drift h-full w-full rounded-full"
        style={{ background: VARIANTS[variant], filter: "blur(38px)" }}
      />
    </div>
  );
}
