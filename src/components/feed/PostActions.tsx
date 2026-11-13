"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import type { PublicPost } from "@/lib/postRules";

const Heart = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill={on ? "#e0245e" : "none"} stroke={on ? "#e0245e" : "currentColor"} strokeWidth="1.8" aria-hidden>
    <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.4 0 5.7 3.1 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />
  </svg>
);
const ThumbDown = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
    <path d="M10 15v4.5a2.5 2.5 0 0 0 2.5 2.5l3.5-8V3H7.2a2 2 0 0 0-2 1.7l-1.3 8A2 2 0 0 0 5.9 15H10zM16 3h2.7A2.3 2.3 0 0 1 21 5.3v6.4a2.3 2.3 0 0 1-2.3 2.3H16" />
  </svg>
);
const ShareArrow = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);
const Bookmark = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
    <path d="M6 3.5h12v17l-6-4.2-6 4.2z" />
  </svg>
);

/**
 * ❤️ like (count shown) · 👎 not for me (private, never shown) · ↗ share · 🔖 save. Signed-out visitors are asked to
 * sign up. Changes show at once and are put back if they can't be saved.
 */
export function PostActions({ post, vertical = false, onDisliked }: { post: PublicPost; vertical?: boolean; onDisliked?: () => void }) {
  const { status } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [liked, setLiked] = useState(Boolean(post.liked));
  const [disliked, setDisliked] = useState(Boolean(post.disliked));
  const [saved, setSaved] = useState(Boolean(post.saved));
  const [likes, setLikes] = useState(post.likeCount);

  const needAccount = () => {
    if (status === "signedIn") return false;
    showToast("Sign up to like and save outfits", { label: "Sign up", onClick: () => router.push("/login?create=1") }, { check: false });
    return true;
  };

  async function react(kind: "like" | "dislike" | null) {
    if (needAccount()) return;
    const was = { liked, disliked, likes };
    setLiked(kind === "like");
    setDisliked(kind === "dislike");
    setLikes(Math.max(0, likes + (kind === "like" ? 1 : 0) - (liked ? 1 : 0)));
    const res = await fetch(`/api/posts/${post.id}/react`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) }).catch(() => null);
    if (!res?.ok) {
      setLiked(was.liked);
      setDisliked(was.disliked);
      setLikes(was.likes);
      return showToast("Couldn't save that. Please try again.");
    }
    setLikes(((await res.json()) as { likeCount: number }).likeCount);
    if (kind === "dislike") {
      showToast("We'll show you fewer like this", { label: "Undo", onClick: () => void react(null) }, { check: false });
      onDisliked?.();
    }
  }

  async function toggleSave() {
    if (needAccount()) return;
    const next = !saved;
    setSaved(next);
    const res = await fetch(`/api/posts/${post.id}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ saved: next }) }).catch(() => null);
    if (!res?.ok) {
      setSaved(!next);
      return showToast("Couldn't save that. Please try again.");
    }
    if (next) showToast("Saved to Inspiration");
  }

  async function share() {
    const url = `${location.origin}/p/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `@${post.creator.username} on VIRM`, url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      showToast(url);
    }
  }

  const btn = "flex flex-col items-center gap-0.5 text-[11.5px] font-semibold";
  return (
    <div className={`flex ${vertical ? "flex-col gap-5" : "items-center gap-5"}`}>
      <button onClick={() => react(liked ? null : "like")} aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} className={btn}>
        <Heart on={liked} />
        {likes > 0 && <span>{likes}</span>}
      </button>
      <button onClick={() => react(disliked ? null : "dislike")} aria-pressed={disliked} aria-label="Not for me" title="Not for me (only you see this)" className={btn}>
        <ThumbDown on={disliked} />
      </button>
      <button onClick={share} aria-label="Share" className={btn}>
        <ShareArrow />
      </button>
      <button onClick={toggleSave} aria-pressed={saved} aria-label={saved ? "Saved" : "Save"} className={btn}>
        <Bookmark on={saved} />
      </button>
    </div>
  );
}
