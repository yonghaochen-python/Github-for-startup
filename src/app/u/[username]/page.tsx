"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicPost } from "@/lib/postRules";
import { useParams } from "next/navigation";
import type { PublicProfile } from "@/lib/profiles";
import { PageShell, btnPrimary } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/feed/FollowButton";
import { useAuth } from "@/components/AuthProvider";
import type { FollowState } from "@/lib/postRules";

const joined = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });

/** Someone's public profile: picture, name, @username, bio, counts, Follow, and their posts. Open to everyone. */
export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfile | null | "missing">(null);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  // Your own profile, when you may post: the way to make a new post.
  const [mineCanPost, setMineCanPost] = useState(false);
  const [follow, setFollow] = useState<FollowState | null>(null);
  const { status } = useAuth();

  useEffect(() => {
    let gone = false;
    fetch(`/api/profiles/${encodeURIComponent(username)}`)
      .then(async (res) => (res.ok ? ((await res.json()) as { profile: PublicProfile }).profile : "missing"))
      .then((p) => !gone && setProfile(p))
      .catch(() => !gone && setProfile("missing"));
    fetch(`/api/profiles/${encodeURIComponent(username)}/posts`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { posts: PublicPost[] }).posts : []))
      .then((p) => !gone && setPosts(p))
      .catch(() => {});
    fetch(`/api/profiles/${encodeURIComponent(username)}/follow`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as FollowState) : null))
      .then((f) => !gone && setFollow(f))
      .catch(() => {});
    fetch("/api/me/can-post", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { canPost: boolean; username: string | null }) : null))
      .then((me) => !gone && setMineCanPost(Boolean(me?.canPost && me.username === username.toLowerCase())))
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [username]);

  return (
    <main className="flex-1 pb-20">
      <PageShell className="pt-10 sm:pt-14">
        {profile === null ? (
          <div className="mx-auto h-40 max-w-md animate-pulse rounded-[22px] bg-white/60" />
        ) : profile === "missing" ? (
          <p className="text-center text-[15px] text-[#4f5b66]">This profile doesn&apos;t exist.</p>
        ) : (
          <section className="mx-auto flex max-w-md flex-col items-center text-center">
            <Avatar url={profile.avatarUrl} name={profile.displayName ?? profile.username} size={112} />
            {profile.displayName && <h1 className="mt-4 font-display text-[34px] leading-none text-[#121821]">{profile.displayName}</h1>}
            <p className={`${profile.displayName ? "mt-1.5 text-[14px] text-[#5d6874]" : "mt-4 font-display text-[30px] text-[#121821]"}`}>@{profile.username}</p>
            {profile.bio && <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-[#26313a]">{profile.bio}</p>}
            {follow && (
              <p className="mt-3 flex gap-4 text-[13px] text-[#5d6874]">
                <span>
                  <b className="font-semibold text-[#121821]">{posts.length}</b> {posts.length === 1 ? "post" : "posts"}
                </span>
                <span>
                  <b className="font-semibold text-[#121821]">{follow.followers}</b> {follow.followers === 1 ? "follower" : "followers"}
                </span>
                <span>
                  <b className="font-semibold text-[#121821]">{follow.following}</b> following
                </span>
              </p>
            )}
            <p className="mt-2 text-[12px] text-[#5d6874]">Joined {joined(profile.joined)}</p>
            {follow && follow.followed !== null && (
              <div className="mt-4">
                <FollowButton key={String(follow.followed)} username={profile.username} followed={follow.followed} onChange={(state) => state && setFollow(state)} />
              </div>
            )}
            {/* Signed out: Follow asks them to sign up. */}
            {follow && follow.followed === null && status === "signedOut" && (
              <div className="mt-4">
                <FollowButton username={profile.username} followed={false} />
              </div>
            )}
            {mineCanPost && (
              <Link href="/create" className={`${btnPrimary} mt-5`}>
                ＋ Post an outfit
              </Link>
            )}
          </section>
        )}
        {/* Their posts, newest first, as a grid of pictures. */}
        {profile && profile !== "missing" && posts.length > 0 && (
          <ul className="mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-1 sm:gap-2">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}`} className="relative block overflow-hidden bg-[#f1efeb] sm:rounded-[10px]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a public post picture (a video post's cover) */}
                  <img src={p.imageUrl} alt={p.caption ?? "Outfit"} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                  {p.videoUrl && (
                    <span aria-label="Video" className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                        <path d="M8 5.5v13l10.5-6.5z" />
                      </svg>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageShell>
    </main>
  );
}
