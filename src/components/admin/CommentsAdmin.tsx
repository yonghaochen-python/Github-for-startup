"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { REPORT_REASONS } from "@/lib/postRules";
import { btnPrimary, btnSecondary } from "@/components/ui";

type Queued = { id: string; body: string; status: string; postId: string; username: string | null; reasons: string[] };
const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

/** Admin: comments waiting for review (hidden after reports, or with open reports): restore, remove or keep. */
export function CommentsAdmin() {
  const [queue, setQueue] = useState<Queued[] | null>(null);
  const load = useCallback(() => {
    fetch("/api/admin/comments", { cache: "no-store" })
      .then(async (res) => (res.ok ? setQueue(((await res.json()) as { queue: Queued[] }).queue) : null))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function act(commentId: string, action: "restore" | "remove" | "dismiss") {
    await fetch("/api/admin/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commentId, action }) }).catch(() => null);
    load();
  }

  if (!queue) return null;
  return (
    <div className="mt-6">
      <p className="text-[13px] text-[#4f5b66]">Comments · {queue.length === 0 ? "nothing to review" : `${queue.length} to review`}</p>
      <ul className="mt-3 flex flex-col gap-3">
        {queue.map((c) => (
          <li key={c.id} className="rounded-[16px] bg-white p-3 text-[12.5px] text-[#26313a] shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]">
            <p>
              <span className="font-semibold">@{c.username ?? "?"}</span> on{" "}
              <Link href={`/p/${c.postId}`} className="underline underline-offset-4">
                this post
              </Link>{" "}
              · {c.status === "hidden" ? "hidden until reviewed" : "still showing"}
            </p>
            <p className="mt-1 whitespace-pre-line break-words text-[13.5px] text-[#121821]">{c.body}</p>
            <p className="mt-1 text-[#5d6874]">
              {c.reasons.length} {c.reasons.length === 1 ? "report" : "reports"}: {c.reasons.map(reasonLabel).join(", ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => act(c.id, c.status === "hidden" ? "restore" : "dismiss")} className={`${btnSecondary} !min-h-[34px] !px-3 !text-[12px]`}>
                {c.status === "hidden" ? "Restore" : "Keep it"}
              </button>
              <button onClick={() => act(c.id, "remove")} className={`${btnPrimary} !min-h-[34px] !px-3 !text-[12px]`}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
