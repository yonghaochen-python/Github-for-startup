"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Dialog } from "@/components/Dialog";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { COMMENT_MAX, REPORT_REASONS, type PublicComment, type PublicPost } from "@/lib/postRules";

/** "3m", "2h", "5d", or a date. */
function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * A post's comments, oldest first, with a box to write one. Whoever wrote a comment, and the post's owner, can delete
 * it; anyone signed in can report someone else's. `onCount` hears the new number when it changes.
 */
export function CommentList({ postId, onCount, autoFocus = false }: { postId: string; onCount?: (n: number) => void; autoFocus?: boolean }) {
  const { status } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [comments, setComments] = useState<PublicComment[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<{ message: string; code?: string } | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const end = useRef<HTMLDivElement | null>(null);
  const counted = useRef(onCount);
  useEffect(() => {
    counted.current = onCount;
  });

  useEffect(() => {
    let gone = false;
    fetch(`/api/posts/${postId}/comments`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { comments: PublicComment[] }).comments : []))
      .then((list) => {
        if (gone) return;
        setComments(list);
        counted.current?.(list.length);
      })
      .catch(() => !gone && setComments([]));
    return () => {
      gone = true;
    };
  }, [postId]);

  const update = (list: PublicComment[]) => {
    setComments(list);
    onCount?.(list.length);
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setProblem(null);
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: text }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { comment?: PublicComment; error?: string; code?: string }) : {};
    setSending(false);
    if (!res?.ok || !data.comment) return setProblem({ message: data.error ?? "Couldn't send that. Please try again.", code: data.code });
    setText("");
    update([...(comments ?? []), data.comment]);
    requestAnimationFrame(() => end.current?.scrollIntoView({ block: "nearest" }));
  }

  async function remove(id: string) {
    const was = comments ?? [];
    update(was.filter((c) => c.id !== id));
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      update(was);
      showToast("Couldn't delete it. Please try again.");
    }
  }

  async function report(id: string, reason: string) {
    setReporting(null);
    const res = await fetch(`/api/comments/${id}/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => null);
    showToast(res?.ok ? "Thanks. We'll take a look." : "Couldn't send that. Please try again.");
  }

  return (
    <div>
      {comments === null ? (
        <p className="py-6 text-center text-[13px] text-[#8a949e]">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[#8a949e]">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3.5 py-2">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Link href={`/u/${c.creator.username}`} className="shrink-0">
                <Avatar url={c.creator.avatarUrl} name={c.creator.displayName ?? c.creator.username} size={30} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-[#5d6874]">
                  <Link href={`/u/${c.creator.username}`} className="font-semibold text-[#121821]">
                    @{c.creator.username}
                  </Link>{" "}
                  · {ago(c.createdAt)}
                </p>
                <p className="mt-0.5 whitespace-pre-line break-words text-[14px] leading-snug text-[#121821]">{c.body}</p>
                <div className="mt-1 flex gap-3 text-[11.5px] font-semibold text-[#8a949e]">
                  {c.canDelete && (
                    <button onClick={() => remove(c.id)} className="hover:text-[#a1312a]">
                      Delete
                    </button>
                  )}
                  {status === "signedIn" && !c.mine && (
                    <button onClick={() => setReporting(reporting === c.id ? null : c.id)} className="hover:text-[#121821]">
                      Report
                    </button>
                  )}
                </div>
                {reporting === c.id && (
                  <div role="group" aria-label="Why are you reporting this comment?" className="mt-1.5 flex flex-wrap gap-1.5">
                    {REPORT_REASONS.filter((r) => r.value !== "not_mine").map((r) => (
                      <button
                        key={r.value}
                        onClick={() => report(c.id, r.value)}
                        className="rounded-full bg-white px-2.5 py-1 text-[11.5px] text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div ref={end} />
      {status === "signedIn" ? (
        <form onSubmit={send} className="mt-2 flex items-end gap-2 border-t border-black/[0.06] pt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            autoFocus={autoFocus}
            placeholder="Add a comment"
            aria-label="Add a comment"
            className="max-h-28 min-h-[40px] flex-1 resize-none rounded-[20px] bg-[#f6f5f2] px-4 py-2.5 text-[14px] text-[#121821] outline-none placeholder:text-[#8a949e] focus:shadow-[inset_0_0_0_1.5px_#121821]"
          />
          <button type="submit" disabled={!text.trim() || sending} className="h-10 shrink-0 rounded-full bg-[#121821] px-4 text-[13px] font-semibold text-white disabled:opacity-40">
            {sending ? "…" : "Send"}
          </button>
        </form>
      ) : (
        <button onClick={() => router.push("/login?create=1")} className="mt-2 w-full border-t border-black/[0.06] pt-3 text-center text-[13px] font-semibold text-[#121821]">
          Sign up to comment
        </button>
      )}
      {problem && (
        <p role="alert" className="mt-2 text-[12.5px] text-[#a1312a]">
          {problem.message}{" "}
          {problem.code === "needs_username" && (
            <Link href="/profile" className="font-semibold underline underline-offset-2">
              Pick one
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

const Bubble = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
    <path d="M12 3.5c4.97 0 9 3.36 9 7.5s-4.03 7.5-9 7.5c-1.06 0-2.08-.15-3.02-.43L4 20l1.3-3.7C3.85 14.95 3 13.07 3 11c0-4.14 4.03-7.5 9-7.5z" />
  </svg>
);

/** The comment circle in the phone feed: opens the comments in a sheet over the outfit. */
export function CommentsButton({ post }: { post: PublicPost }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(post.commentCount);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={`Comments (${count})`} className="flex flex-col items-center gap-1">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-transform active:scale-90">
          <Bubble />
        </span>
        {count > 0 && <span className="text-[11.5px] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">{count}</span>}
      </button>
      {open &&
        createPortal(
          <Dialog label="Comments" onClose={() => setOpen(false)} className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-[22px] bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-[#121821]">Comments{count > 0 ? ` · ${count}` : ""}</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-[20px] text-[#5d6874]">
                ×
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto">
              <CommentList postId={post.id} onCount={setCount} />
            </div>
          </Dialog>,
          document.body
        )}
    </>
  );
}
