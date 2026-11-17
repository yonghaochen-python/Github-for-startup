"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Dialog } from "@/components/Dialog";
import { PieceRow } from "@/components/feed/PiecesSheet";
import { TryThisOutfit } from "@/components/feed/TryThisOutfit";
import type { PublicPost } from "@/lib/postRules";

/**
 * Phones: the post's description in two lines with "… more". More slides a page up from the post: who posted it, the
 * whole description and tags, then the pieces (with Shop links) and Recreate. ✕ (or a tap outside) closes it.
 */
export function PostMore({ post }: { post: PublicPost }) {
  const [open, setOpen] = useState(false);
  const tags = [...post.styleTags, ...post.occasionTags];
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-1.5 block w-full text-left" aria-haspopup="dialog">
        {post.caption && <span className="line-clamp-2 text-[14px] leading-snug text-white/90">{post.caption}</span>}
        <span className="text-[13px] font-semibold text-white/60">… more</span>
      </button>
      {open &&
        createPortal(
          <Dialog
            label="About this outfit"
            onClose={() => setOpen(false)}
            className="max-h-[85dvh] w-full max-w-md animate-[sheet-up_.32s_cubic-bezier(.3,.7,.2,1)] overflow-y-auto rounded-[22px] bg-white p-4 shadow-xl motion-reduce:animate-none"
          >
            <div className="flex items-center gap-2.5">
              <Link href={`/u/${post.creator.username}`} className="flex min-w-0 items-center gap-2.5">
                <Avatar url={post.creator.avatarUrl} name={post.creator.displayName ?? post.creator.username} size={34} />
                <span className="truncate text-[14px] font-semibold text-[#121821]">@{post.creator.username}</span>
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f1f3f4] text-[20px] leading-none text-[#121821]"
              >
                ×
              </button>
            </div>
            {post.caption && <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-[#121821]">{post.caption}</p>}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="rounded-full bg-[#f1efeb] px-3 py-1 text-[12px] text-[#4f5b66]">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {post.items.length > 0 && (
              <>
                <h2 className="mt-5 text-[11px] font-semibold uppercase tracking-[2px] text-[#5d6874]">Pieces</h2>
                <ul className="mt-1 divide-y divide-black/[0.06]">
                  {post.items.map((it, i) => (
                    <PieceRow key={i} it={it} />
                  ))}
                </ul>
                <div className="mt-3">
                  <TryThisOutfit post={post} />
                </div>
              </>
            )}
          </Dialog>,
          document.body
        )}
    </>
  );
}
