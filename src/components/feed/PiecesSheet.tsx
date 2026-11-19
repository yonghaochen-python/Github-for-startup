"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/Dialog";
import type { PublicPost } from "@/lib/postRules";

/** The hanger mark for "Pieces". */
const Hanger = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 7.5a2 2 0 1 1 2-2M12 7.5v1.2L3.5 14.5c-.9.6-.5 2 .6 2h15.8c1.1 0 1.5-1.4.6-2L12 8.7" />
  </svg>
);

/** One piece: its picture, name, the details its poster shared, and Shop when there's a link. */
export function PieceRow({ it }: { it: PublicPost["items"][number] }) {
  const details = [...new Set([it.brand, it.store].filter(Boolean)), it.price].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 py-2.5">
      {it.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a public post item picture
        <img src={it.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-[12px] bg-[#f4f3f0] object-contain p-0.5" />
      ) : (
        <span aria-hidden className="h-14 w-14 shrink-0 rounded-[12px] bg-[#f4f3f0]" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-[#121821]">{it.name}</span>
        {details && <span className="block truncate text-[12px] text-[#5d6874]">{details}</span>}
        {it.detailsPrivate && <span className="block text-[11px] text-[#8a949e]">Details: only you</span>}
      </span>
      {it.link && <ShopLink href={it.link} />}
    </li>
  );
}

/** The website a link opens, as people know it ("zara.com"). */
export const linkSite = (href: string) => {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Shop, with the website it opens written under it, so a strange link shows before anyone taps it. */
export function ShopLink({ href }: { href: string }) {
  const site = linkSite(href);
  return (
    <span className="flex shrink-0 flex-col items-center gap-0.5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        aria-label={site ? `Shop on ${site} (opens a new tab)` : "Shop (opens a new tab)"}
        className="rounded-full bg-[#121821] px-3.5 py-1.5 text-[12px] font-semibold text-white"
      >
        Shop
      </a>
      {site && <span className="max-w-[96px] truncate text-[10.5px] text-[#5d6874]">{site}</span>}
    </span>
  );
}

/**
 * "Pieces": what the outfit is made of, in a sheet over the feed (the outfit stays where it was). `children` goes at
 * the foot, for Recreate with My Closet.
 */
export function PiecesButton({ post, children }: { post: PublicPost; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (post.items.length === 0) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-[12.5px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md md:bg-white md:text-[#121821] md:ring-black/10"
      >
        <Hanger />
        Pieces
      </button>
      {open &&
        createPortal(
          <Dialog label="Pieces" onClose={() => setOpen(false)} className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-[22px] bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-[#121821]">Pieces</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-[20px] text-[#5d6874]">
                ×
              </button>
            </div>
            <ul className="mt-1 divide-y divide-black/[0.06]">
              {post.items.map((it, i) => (
                <PieceRow key={i} it={it} />
              ))}
            </ul>
            {children && <div className="mt-3">{children}</div>}
          </Dialog>,
          document.body
        )}
    </>
  );
}
