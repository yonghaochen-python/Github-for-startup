/**
 * Decorative liquid-metal accent shapes, one per surface (landing, closet, outfits,
 * outfit detail, try-on) so the premium look doesn't read as one image pasted onto
 * every page. Each variant is its own gradient recipe, silhouette, and rotation —
 * not just a recolor of the same blob.
 */
export type BlobVariant = "rose" | "slate" | "pearl" | "graphite" | "frost" | "mercury";

const VARIANTS: Record<BlobVariant, { background: string; borderRadius: string; rotate: string }> = {
  rose: {
    background:
      "radial-gradient(circle at 26% 20%, rgba(255,255,255,0.95), transparent 30%), " +
      "radial-gradient(circle at 70% 12%, rgba(255,255,255,0.7), transparent 26%), " +
      "radial-gradient(circle at 78% 60%, rgba(240,175,196,0.65), transparent 42%), " +
      "radial-gradient(circle at 28% 76%, rgba(255,255,255,0.5), transparent 36%), " +
      "radial-gradient(circle at 54% 46%, rgba(15,15,17,0.85), transparent 46%), " +
      "linear-gradient(155deg, #eaeaed 0%, #9b9ba0 14%, #f4d3de 26%, #17171a 40%, #cfcfd3 54%, #f2c9d6 68%, #0c0c0e 82%, #d8d8dc 100%)",
    borderRadius: "46% 54% 52% 48% / 56% 44% 60% 40%",
    rotate: "-8deg",
  },
  slate: {
    background:
      "radial-gradient(circle at 30% 22%, rgba(255,255,255,0.9), transparent 32%), " +
      "radial-gradient(circle at 72% 18%, rgba(198,210,222,0.6), transparent 30%), " +
      "radial-gradient(circle at 70% 68%, rgba(120,140,158,0.6), transparent 44%), " +
      "radial-gradient(circle at 24% 72%, rgba(255,255,255,0.4), transparent 38%), " +
      "radial-gradient(circle at 50% 46%, rgba(10,12,15,0.85), transparent 46%), " +
      "linear-gradient(140deg, #e4e8ec 0%, #8b95a0 16%, #c9d2da 30%, #12151a 44%, #a9b2ba 58%, #cfd6dc 74%, #0c0e12 88%, #dde2e6 100%)",
    borderRadius: "54% 46% 58% 42% / 44% 56% 40% 60%",
    rotate: "10deg",
  },
  pearl: {
    background:
      "radial-gradient(circle at 24% 26%, rgba(255,255,255,0.92), transparent 34%), " +
      "radial-gradient(circle at 68% 14%, rgba(244,230,210,0.55), transparent 30%), " +
      "radial-gradient(circle at 74% 64%, rgba(214,196,170,0.5), transparent 42%), " +
      "radial-gradient(circle at 26% 74%, rgba(255,255,255,0.45), transparent 38%), " +
      "radial-gradient(circle at 50% 48%, rgba(18,16,14,0.82), transparent 46%), " +
      "linear-gradient(150deg, #efe9de 0%, #a49c8c 16%, #e8d9c2 30%, #17140f 46%, #cabfa8 60%, #f0e6d2 76%, #0e0c09 90%, #e3dbca 100%)",
    borderRadius: "48% 52% 44% 56% / 58% 42% 56% 44%",
    rotate: "-5deg",
  },
  graphite: {
    background:
      "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.55), transparent 34%), " +
      "radial-gradient(circle at 70% 70%, rgba(90,90,96,0.5), transparent 44%), " +
      "radial-gradient(circle at 50% 46%, rgba(8,8,9,0.9), transparent 48%), " +
      "linear-gradient(150deg, #86868c 0%, #2a2a2e 30%, #4c4c52 55%, #141416 78%, #38383c 100%)",
    borderRadius: "50% 50% 46% 54% / 52% 48% 54% 46%",
    rotate: "14deg",
  },
  frost: {
    background:
      "radial-gradient(circle at 28% 22%, rgba(255,255,255,0.95), transparent 32%), " +
      "radial-gradient(circle at 70% 16%, rgba(214,232,242,0.6), transparent 30%), " +
      "radial-gradient(circle at 68% 68%, rgba(170,198,216,0.55), transparent 44%), " +
      "radial-gradient(circle at 50% 46%, rgba(10,14,18,0.8), transparent 46%), " +
      "linear-gradient(145deg, #eef4f7 0%, #a9bfca 18%, #dbe8ee 34%, #12171b 50%, #b7ccd6 66%, #e6eef2 82%, #0d1114 96%)",
    borderRadius: "56% 44% 48% 52% / 46% 54% 44% 56%",
    rotate: "-12deg",
  },
  mercury: {
    background:
      "radial-gradient(circle at 22% 18%, rgba(255,255,255,0.98), transparent 28%), " +
      "radial-gradient(circle at 66% 10%, rgba(255,255,255,0.75), transparent 24%), " +
      "radial-gradient(circle at 80% 54%, rgba(196,202,208,0.6), transparent 40%), " +
      "radial-gradient(circle at 30% 80%, rgba(255,255,255,0.55), transparent 36%), " +
      "radial-gradient(circle at 54% 44%, rgba(6,7,9,0.88), transparent 48%), " +
      "linear-gradient(160deg, #f5f6f7 0%, #b7bcc0 12%, #e6e8ea 24%, #0a0b0d 38%, #9ca1a6 52%, #dcdfe1 66%, #07080a 80%, #c7cbce 92%, #f0f1f2 100%)",
    borderRadius: "50% 50% 56% 44% / 40% 60% 42% 58%",
    rotate: "4deg",
  },
};

export function HeroBlob({ variant, className = "" }: { variant: BlobVariant; className?: string }) {
  const v = VARIANTS[variant];
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{
        background: v.background,
        borderRadius: v.borderRadius,
        filter: "blur(3px) saturate(1.1)",
        transform: `rotate(${v.rotate})`,
      }}
    />
  );
}
