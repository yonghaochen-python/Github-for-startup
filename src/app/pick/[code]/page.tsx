import type { Metadata } from "next";
import { headers } from "next/headers";
import { findOpenPick, pickLabels } from "@/lib/picks";
import { PickView } from "./PickView";

/** The link friends open: the two looks, a tap to vote, then a way to try Virm themselves. */
export async function generateMetadata({ params }: PageProps<"/pick/[code]">): Promise<Metadata> {
  const { code } = await params;
  const pick = await findOpenPick(code).catch(() => null);
  if (!pick) return { title: "Virm", robots: { index: false } };
  const single = pickLabels(pick).length === 1;
  const title = single ? "How does this look?" : "Which one tonight?";
  const name = pick.user.displayName ?? (single ? "Your friend" : null);
  const who = single ? `${name} tried this on with Virm.` : `${name ? `${name} can't` : "Your friend can't"} decide.`;
  const ask = single ? "Tap to love it." : "Tap to vote.";
  // Link previews need a full address for the picture.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const image = `${origin}/api/picks/${code}/image/card`;
  return {
    title,
    description: `${who} ${ask}`,
    robots: { index: false },
    openGraph: { title, description: `${who} ${ask}`, images: [{ url: image, width: 1200, height: 800 }] },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

export default async function PickPage({ params }: PageProps<"/pick/[code]">) {
  const { code } = await params;
  return <PickView code={code} />;
}
