import type { Metadata } from "next";
import { headers } from "next/headers";
import { findOpenPick } from "@/lib/picks";
import { PickView } from "./PickView";

/** The link friends open: the two looks, a tap to vote, then a way to try Virm themselves. */
export async function generateMetadata({ params }: PageProps<"/pick/[code]">): Promise<Metadata> {
  const { code } = await params;
  const pick = await findOpenPick(code).catch(() => null);
  const title = "Which one tonight?";
  if (!pick) return { title: "Virm", robots: { index: false } };
  const who = pick.user.displayName ? `${pick.user.displayName} can't decide.` : "Your friend can't decide.";
  // Link previews need a full address for the picture.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const image = `${origin}/api/picks/${code}/image/card`;
  return {
    title,
    description: `${who} Tap to vote A or B.`,
    robots: { index: false },
    openGraph: { title, description: `${who} Tap to vote A or B.`, images: [{ url: image, width: 1200, height: 800 }] },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

export default async function PickPage({ params }: PageProps<"/pick/[code]">) {
  const { code } = await params;
  return <PickView code={code} />;
}
