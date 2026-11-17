"use client";

import { createPortal } from "react-dom";
import { Dialog } from "@/components/Dialog";

/**
 * The post as people will see it on Discover (the picture first, the words underneath), with the last check before it
 * goes public (`children`) and Post.
 */
export function PostPreview({
  imageUrl,
  videoUrl,
  progress = null,
  username,
  caption,
  tags,
  pieces,
  busy,
  error,
  onClose,
  onPost,
  canPost,
  postLabel = "Post",
  children,
}: {
  imageUrl: string;
  /** A video post: shown playing (muted), as on Discover. */
  videoUrl?: string;
  /** Sending the video: 0–1. */
  progress?: number | null;
  username: string;
  caption: string;
  tags: string[];
  pieces: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onPost: () => void;
  canPost: boolean;
  postLabel?: string;
  children?: React.ReactNode;
}) {
  return createPortal(
    <Dialog label="Preview" onClose={() => !busy && onClose()} className="flex max-h-[94dvh] w-full max-w-sm flex-col overflow-hidden rounded-[24px] bg-white shadow-xl">
      {/* Like the feed: the outfit on dark, the words under it. */}
      <div className="min-h-0 overflow-y-auto">
        <div className="bg-[#0b0f14]">
          {videoUrl ? (
            <video src={videoUrl} poster={imageUrl} autoPlay muted loop playsInline className="mx-auto max-h-[52dvh] w-auto object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- the person's own picture, not uploaded yet
            <img src={imageUrl} alt="Your post" className="mx-auto max-h-[52dvh] w-auto object-contain" />
          )}
          <div className="px-4 pb-4 pt-3 text-white">
            <p className="text-[13.5px] font-semibold">@{username}</p>
            {caption.trim() && <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-white/90">{caption}</p>}
            {tags.length > 0 && <p className="mt-1 truncate text-[12px] text-white/55">{tags.join(" · ")}</p>}
            {pieces > 0 && (
              <span className="mt-2.5 inline-flex rounded-full bg-white/15 px-3.5 py-1.5 text-[12px] font-semibold ring-1 ring-white/25">Pieces · {pieces}</span>
            )}
          </div>
        </div>
        <div className="p-4">
          {children}
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-[#a1312a]">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 border-t border-black/[0.06] p-3">
        <button onClick={onPost} disabled={!canPost || busy} className="flex-1 rounded-full bg-[#121821] py-3 text-[14.5px] font-semibold text-white disabled:opacity-40">
          {progress !== null ? `Sending video ${Math.round(progress * 100)}%` : busy ? "One moment…" : postLabel}
        </button>
        <button onClick={onClose} disabled={busy} className="rounded-full px-5 py-3 text-[14px] font-semibold text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]">
          Edit
        </button>
      </div>
    </Dialog>,
    document.body
  );
}
