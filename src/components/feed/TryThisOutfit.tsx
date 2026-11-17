"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Dialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import {
  TRY_POST_KEY,
  type PublicPost,
  type TryPostHandoff,
  type TryPostPiece,
} from "@/lib/postRules";

type Choice = "mine" | "theirs" | null;

/**
 * "Recreate with My Closet": the post's pieces, each matched to the closest piece in your closet. Pick yours or theirs for
 * each, then it opens in Studio dressed that way. Free: the try-on only runs (and counts) when you press Try On there.
 */
export function TryThisOutfit({
  post,
  variant = "page",
  openRequest = 0,
}: {
  post: PublicPost;
  variant?: "page" | "feed";
  /** A new number opens it (a slide left on the feed, or the R key). */
  openRequest?: number;
}) {
  const { status } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [pieces, setPieces] = useState<TryPostPiece[] | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [failed, setFailed] = useState(false);

  const lastRequest = useRef(openRequest);
  useEffect(() => {
    if (openRequest === lastRequest.current) return;
    lastRequest.current = openRequest;
    // 0 means "not asked" (another post's turn); only a new number opens it.
    if (!openRequest) return;
    const t = setTimeout(() => void start(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new request arrives
  }, [openRequest]);

  if (post.items.length === 0) return null;

  async function start() {
    if (status !== "signedIn") {
      showToast(
        "Sign up to try outfits on",
        { label: "Sign up", onClick: () => router.push("/login?create=1") },
        { check: false },
      );
      return;
    }
    setOpen(true);
    if (pieces) return;
    setFailed(false);
    const res = await fetch(`/api/posts/${post.id}/match`, {
      cache: "no-store",
    }).catch(() => null);
    if (!res?.ok) return setFailed(true);
    const found = ((await res.json()) as { pieces: TryPostPiece[] }).pieces;
    setPieces(found);
    // Your own piece when it's a near match; otherwise theirs (when it has a picture), else your nearest.
    setChoices(
      found.map((p) =>
        p.mine?.close ? "mine" : p.theirs ? "theirs" : p.mine ? "mine" : null,
      ),
    );
  }

  function openStudio() {
    if (!pieces) return;
    const handoff: TryPostHandoff = { closetIds: [], theirs: [] };
    pieces.forEach((p, i) => {
      if (choices[i] === "mine" && p.mine) handoff.closetIds.push(p.mine.id);
      if (choices[i] === "theirs" && p.theirs)
        handoff.theirs.push({
          name: p.name,
          imageUrl: p.theirs,
          category: p.category ?? "accessory",
          role: p.role,
        });
    });
    try {
      sessionStorage.setItem(TRY_POST_KEY, JSON.stringify(handoff));
    } catch {}
    router.push("/studio?post=1");
  }

  const choose = (i: number, c: Choice) =>
    setChoices((all) =>
      all.map((x, j) => (j === i ? (x === c ? null : c) : x)),
    );
  const chosen = choices.filter(Boolean).length;
  const yours =
    pieces?.filter((p, i) => choices[i] === "mine" && p.mine).length ?? 0;

  return (
    <>
      <button
        onClick={start}
        className={
          variant === "feed"
            ? "inline-flex items-center whitespace-nowrap rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-[#121821] shadow-sm md:bg-[#121821] md:text-white"
            : "w-full rounded-full bg-[#121821] px-5 py-3 text-[14.5px] font-semibold text-white"
        }
      >
        Recreate
      </button>
      {/* Drawn at the top of the page: on the feed the button sits in a layer that lets taps through. */}
      {open &&
        createPortal(
          <Dialog
            label="Recreate with My Closet"
            onClose={() => setOpen(false)}
            className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-[22px] bg-white p-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-[#121821]">
                Recreate with My Closet
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-[20px] text-[#5d6874]"
              >
                ×
              </button>
            </div>
            {failed ? (
              <p className="py-8 text-center text-[14px] text-[#5d6874]">
                Couldn&apos;t load your closet. Please try again.
              </p>
            ) : !pieces ? (
              <p className="py-8 text-center text-[14px] text-[#5d6874]">
                Finding pieces in your closet…
              </p>
            ) : (
              <>
                <p className="mt-0.5 text-[12.5px] text-[#5d6874]">
                  Yours or theirs, for each piece
                </p>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {pieces.map((p, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-[#121821]">
                          {p.name}
                        </span>
                        {p.mine && (
                          <span className="block text-[11.5px] text-[#8a949e]">
                            {p.mine.close ? "Close match" : "Nearest you have"}
                          </span>
                        )}
                      </span>
                      <Pick
                        label="Yours"
                        src={p.mine?.imageUrl}
                        on={choices[i] === "mine"}
                        onClick={() => choose(i, "mine")}
                      />
                      <Pick
                        label="Theirs"
                        src={p.theirs}
                        on={choices[i] === "theirs"}
                        onClick={() => choose(i, "theirs")}
                      />
                    </li>
                  ))}
                </ul>
                <button
                  onClick={openStudio}
                  disabled={chosen === 0}
                  className="mt-4 w-full rounded-full bg-[#121821] px-5 py-3 text-[14.5px] font-semibold text-white disabled:opacity-40"
                >
                  Open in Studio
                </button>
                <p className="mt-2 text-center text-[11.5px] text-[#8a949e]">
                  {yours > 0 ? `${yours} from your closet · ` : ""}Free until
                  you press Try On
                </p>
              </>
            )}
          </Dialog>,
          document.body,
        )}
    </>
  );
}

function Pick({
  label,
  src,
  on,
  onClick,
}: {
  label: string;
  src?: string | null;
  on: boolean;
  onClick: () => void;
}) {
  if (!src) {
    return (
      <span className="flex w-14 shrink-0 flex-col items-center gap-0.5">
        <span className="grid h-14 w-14 place-items-center rounded-[12px] bg-[#f4f3f0] text-[10.5px] text-[#a3abb3]">
          None
        </span>
        <span className="text-[10.5px] text-[#a3abb3]">{label}</span>
      </span>
    );
  }
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={`${label}${on ? " (chosen)" : ""}`}
      className="flex w-14 shrink-0 flex-col items-center gap-0.5"
    >
      <span
        className={`block h-14 w-14 overflow-hidden rounded-[12px] bg-[#f4f3f0] ${on ? "ring-2 ring-[#121821] ring-offset-1" : "opacity-60"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a closet or post piece picture */}
        <img src={src} alt="" className="h-full w-full object-contain p-0.5" />
      </span>
      <span
        className={`text-[10.5px] ${on ? "font-semibold text-[#121821]" : "text-[#8a949e]"}`}
      >
        {label}
      </span>
    </button>
  );
}
