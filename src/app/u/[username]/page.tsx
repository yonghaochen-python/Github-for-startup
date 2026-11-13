"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PublicProfile } from "@/lib/profiles";
import { PageShell } from "@/components/ui";
import { Avatar } from "@/components/Avatar";

const joined = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });

/** Someone's public profile: picture, name, @username and bio (posts arrive in the next stage). Open to everyone. */
export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfile | null | "missing">(null);

  useEffect(() => {
    let gone = false;
    fetch(`/api/profiles/${encodeURIComponent(username)}`)
      .then(async (res) => (res.ok ? ((await res.json()) as { profile: PublicProfile }).profile : "missing"))
      .then((p) => !gone && setProfile(p))
      .catch(() => !gone && setProfile("missing"));
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
            <p className="mt-3 text-[12px] text-[#5d6874]">Joined {joined(profile.joined)}</p>
          </section>
        )}
      </PageShell>
    </main>
  );
}
