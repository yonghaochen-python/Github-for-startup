"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useToast } from "@/components/Toast";
import { REPORT_REASONS, type PublicPost } from "@/lib/postRules";
import { PageShell } from "@/components/ui";

/** One outfit post: big photo, who posted it, caption, tags and pieces. Open to everyone. */
export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { status } = useAuth();
  const { showToast } = useToast();
  const [post, setPost] = useState<PublicPost | null | "missing">(null);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let gone = false;
    fetch(`/api/posts/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { post: PublicPost }).post : "missing"))
      .then((p) => !gone && setPost(p))
      .catch(() => !gone && setPost("missing"));
    return () => {
      gone = true;
    };
  }, [id]);

  if (post === null) return <main className="flex-1" />;
  if (post === "missing") {
    return (
      <main className="flex-1 pb-20">
        <PageShell className="pt-14 text-center">
          <p className="text-[15px] text-[#4f5b66]">This post isn&apos;t available.</p>
        </PageShell>
      </main>
    );
  }

  async function share() {
    const url = `${location.origin}/p/${post && post !== "missing" ? post.id : ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "VIRM", url });
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

  async function report(reason: string) {
    setReporting(false);
    const res = await fetch(`/api/posts/${post && post !== "missing" ? post.id : ""}/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => null);
    showToast(res?.ok ? "Thanks. We'll take a look." : "Couldn't send that. Please try again.");
  }

  async function remove() {
    const res = await fetch(`/api/posts/${post && post !== "missing" ? post.id : ""}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      showToast("Post deleted");
      router.push(post && post !== "missing" ? `/u/${post.creator.username}` : "/");
    } else showToast("Couldn't delete it. Please try again.");
  }

  const tags = [...post.styleTags, ...post.occasionTags];
  return (
    <main className="flex-1 pb-24">
      <PageShell className="max-w-xl pt-6">
        <Link href={`/u/${post.creator.username}`} className="flex items-center gap-2.5">
          <Avatar url={post.creator.avatarUrl} name={post.creator.displayName ?? post.creator.username} size={36} />
          <span className="text-[14px] font-semibold text-[#121821]">@{post.creator.username}</span>
        </Link>

        <div className="mt-3 overflow-hidden rounded-[18px] bg-[#f1efeb]">
          {/* eslint-disable-next-line @next/next/no-img-element -- a public post picture */}
          <img src={post.imageUrl} alt={post.caption ?? "Outfit"} width={post.width} height={post.height} className="h-auto w-full" />
        </div>

        <div className="mt-3 flex items-center gap-4 text-[13px] font-semibold text-[#121821]">
          <button onClick={share} className="underline-offset-4 hover:underline">
            ↗ Share
          </button>
          <span className="ml-auto flex items-center gap-4">
            {post.mine ? (
              <ConfirmButton label="Delete" question="Delete this post?" confirmLabel="Delete" onConfirm={remove} className="text-[#5d6874]" />
            ) : status === "signedIn" ? (
              <button onClick={() => setReporting((v) => !v)} className="text-[#5d6874]">
                Report
              </button>
            ) : null}
          </span>
        </div>
        {reporting && (
          <div role="group" aria-label="Why are you reporting this post?" className="mt-2 flex flex-wrap gap-2">
            {REPORT_REASONS.map((r) => (
              <button key={r.value} onClick={() => report(r.value)} className="rounded-full bg-white px-3 py-1.5 text-[12.5px] text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)]">
                {r.label}
              </button>
            ))}
          </div>
        )}

        {post.caption && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[#121821]">{post.caption}</p>}
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
          <ul className="mt-5 flex flex-col divide-y divide-black/[0.06] rounded-[16px] bg-white px-3 shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]">
            {post.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                {it.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a public post item picture
                  <img src={it.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-[10px] bg-[#f4f3f0] object-contain p-0.5" />
                ) : (
                  <span aria-hidden className="h-12 w-12 shrink-0 rounded-[10px] bg-[#f4f3f0]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-[#121821]">{it.name}</span>
                  {(it.brand || it.store) && <span className="block truncate text-[12px] text-[#5d6874]">{[...new Set([it.brand, it.store].filter(Boolean))].join(" · ")}</span>}
                </span>
                {it.link && (
                  <a href={it.link} target="_blank" rel="noopener noreferrer nofollow ugc" className="shrink-0 rounded-full bg-[#121821] px-3 py-1.5 text-[12px] font-semibold text-white">
                    Shop
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </PageShell>
    </main>
  );
}
