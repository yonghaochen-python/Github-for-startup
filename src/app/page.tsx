"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Feed } from "@/components/feed/Feed";
import { NextStep } from "@/components/NextStep";
import { PageShell } from "@/components/ui";
import { CalendarIcon, CompassIcon, MirrorIcon } from "@/components/Icons";

/**
 * My Style, Virm's first page: your own styling first (your next step, today's outfit, picks from your closet, Style
 * it), with a little inspiration from Discover. Its full sections arrive in the next step; for now it holds Your Next
 * Step and the ways in. Signed-out visitors see Discover (the welcome page comes with the full My Style).
 */
export default function MyStylePage() {
  const { status } = useAuth();
  if (status === "signedOut") return <Feed />;
  if (status !== "signedIn") return <main className="flex-1" />;
  const ways = [
    { href: "/studio", title: "Studio", sub: "Top 3 Picks, Style it and Try On", Icon: MirrorIcon },
    { href: "/planner", title: "Planner", sub: "Today's outfit and your month", Icon: CalendarIcon },
    { href: "/discover", title: "Discover", sub: "Outfits to recreate with your closet", Icon: CompassIcon },
  ];
  return (
    <main className="flex-1 pb-20">
      <PageShell className="max-w-xl pt-8">
        <h1 className="font-display text-[40px] leading-none text-[#121821]">My Style</h1>
        <div className="mt-6">
          <NextStep />
        </div>
        <ul className="mt-6 flex flex-col gap-2">
          {ways.map(({ href, title, sub, Icon }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-4 rounded-[18px] bg-white p-3 shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-[#121821] text-white">
                  <Icon className="h-[22px] w-[22px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15.5px] font-semibold text-[#121821]">{title}</span>
                  <span className="block text-[12.5px] text-[#5d6874]">{sub}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PageShell>
    </main>
  );
}
