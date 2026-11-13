"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { REPORT_REASONS } from "@/lib/postRules";
import { btnPrimary, btnSecondary } from "@/components/ui";

type Queued = { id: string; imageUrl: string; caption: string | null; status: string; createdAt: string; username: string | null; reports: { reason: string; note: string | null }[] };
const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

/** Admin: posts waiting for review (hidden after reports, or with open reports): restore, remove or dismiss. */
export function PostsAdmin() {
  const [data, setData] = useState<{ published: number; total: number; queue: Queued[] } | null>(null);
  const load = useCallback(() => {
    fetch("/api/admin/posts", { cache: "no-store" })
      .then(async (res) => (res.ok ? setData(await res.json()) : null))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function act(postId: string, action: "restore" | "remove" | "dismiss") {
    await fetch("/api/admin/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postId, action }) }).catch(() => null);
    load();
  }

  if (!data) return null;
  return (
    <div>
      <p className="text-[13px] text-[#4f5b66]">
        {data.published} published posts · {data.queue.length === 0 ? "nothing to review" : `${data.queue.length} to review`}
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {data.queue.map((p) => (
          <li key={p.id} className="flex gap-3 rounded-[16px] bg-white p-3 shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a post under review */}
            <img src={p.imageUrl} alt="" className="h-28 w-20 shrink-0 rounded-[10px] bg-[#f1efeb] object-cover" />
            <div className="min-w-0 flex-1 text-[12.5px] text-[#26313a]">
              <p>
                <Link href={`/p/${p.id}`} className="font-semibold underline-offset-4 hover:underline">
                  @{p.username ?? "?"}
                </Link>{" "}
                · {p.status === "hidden" ? "hidden until reviewed" : "still showing"}
              </p>
              {p.caption && <p className="mt-0.5 truncate text-[#5d6874]">{p.caption}</p>}
              <p className="mt-1">
                {p.reports.length} {p.reports.length === 1 ? "report" : "reports"}: {p.reports.map((r) => reasonLabel(r.reason)).join(", ")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.status === "hidden" ? (
                  <button onClick={() => act(p.id, "restore")} className={`${btnSecondary} !min-h-[34px] !px-3 !text-[12px]`}>
                    Restore
                  </button>
                ) : (
                  <button onClick={() => act(p.id, "dismiss")} className={`${btnSecondary} !min-h-[34px] !px-3 !text-[12px]`}>
                    Keep it
                  </button>
                )}
                <button onClick={() => act(p.id, "remove")} className={`${btnPrimary} !min-h-[34px] !px-3 !text-[12px]`}>
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
