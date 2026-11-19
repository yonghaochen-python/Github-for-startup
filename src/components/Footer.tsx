"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const LINKS: { href: string; label: string; short?: string }[] = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy Policy", short: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

/**
 * On every page: the trust links and the "private by design" promise. Not under Discover on phones, where the feed
 * fills the screen (the links are on every other page, and on computers).
 */
export function Footer() {
  const pathname = usePathname();
  // Where the feed fills the phone's screen: Discover.
  const feed = pathname === "/discover";
  return (
    <footer className={`site-footer border-t border-black/[0.06] ${feed ? "max-md:hidden" : ""}`}>
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-2 px-5 py-4 sm:px-8 md:gap-4 md:py-8 lg:flex-row lg:items-center lg:justify-between">
        {/* Phones: two short lines (the promise and ©, then the links); computers: one row. */}
        <p className="flex items-baseline justify-between gap-3 whitespace-nowrap text-[11.5px] font-semibold text-[#26313a] md:block md:text-[13px]">
          <span>
            Private by design <span className="font-normal text-[#4f5b66]">· Your closet stays yours.</span>
          </span>
          <span className="text-[11px] font-normal text-[#5d6874] md:hidden">© 2026 Virm</span>
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-3 gap-y-1 md:gap-x-5 md:gap-y-2">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap text-[11.5px] text-[#4f5b66] underline-offset-4 md:text-[13px] hover:text-[#121821] hover:underline">
              {link.short ? (
                <>
                  <span className="md:hidden">{link.short}</span>
                  <span className="hidden md:inline">{link.label}</span>
                </>
              ) : (
                link.label
              )}
            </Link>
          ))}
        </nav>
        <p className="hidden whitespace-nowrap text-[12px] text-[#5d6874] md:block">© 2026 Virm</p>
      </div>
    </footer>
  );
}
