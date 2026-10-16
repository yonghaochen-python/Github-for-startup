"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { SavedPhotoImage, SavedPhotoSetup, useRemoveSavedPhoto } from "@/components/SavedPhoto";
import { BookmarkIcon, ClosetIcon, SparkleIcon } from "@/components/Icons";
import { PageHeader, PageShell, btnPrimary, btnSecondary, eyebrow } from "@/components/ui";

type Outfit = { id: string; isFavorite: boolean };

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const hasPhoto = Boolean(user?.photoVersion);
  const removeSavedPhoto = useRemoveSavedPhoto();
  const [changing, setChanging] = useState(false);
  const [closetCount, setClosetCount] = useState<number | null>(null);
  const [outfitCount, setOutfitCount] = useState<number | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/closet/items")
      .then(async (res) => res.ok && setClosetCount((((await res.json()) as { items?: unknown[] }).items ?? []).length))
      .catch(() => {});
    fetch("/api/outfits")
      .then(async (res) => {
        if (!res.ok) return;
        const list = ((await res.json()) as { outfits?: Outfit[] }).outfits ?? [];
        setOutfitCount(list.length);
        setSavedCount(list.filter((o) => o.isFavorite).length);
      })
      .catch(() => {});
  }, []);

  const stats: { label: string; value: number | null; href: string; Icon: typeof ClosetIcon }[] = [
    { label: "Closet items", value: closetCount, href: "/closet", Icon: ClosetIcon },
    { label: "Outfits created", value: outfitCount, href: "/outfits", Icon: SparkleIcon },
    { label: "Saved looks", value: savedCount, href: "/outfits/saved", Icon: BookmarkIcon },
  ];

  return (
    <main className="flex-1 pb-16">
      <PageShell>
        <PageHeader label="Profile" title="Profile" description="Your account, your try-on photo, and your wardrobe at a glance." />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section aria-labelledby="account" className="border border-[#cbd7dc] bg-white/60 p-6 sm:p-8">
            <p id="account" className={`${eyebrow} mb-2`}>Signed in as</p>
            <p className="break-all font-display text-[30px] leading-tight text-[#1c2328]">{user?.email ?? "…"}</p>
            <ul className="mt-8 grid grid-cols-3 gap-3 border-t border-[#dce2e4] pt-6">
              {stats.map(({ label, value, href, Icon }) => (
                <li key={label}>
                  <Link href={href} className="group block">
                    <Icon className="mb-2 h-4 w-4 text-[#7e888e]" />
                    <span className="block font-display text-[34px] leading-none text-[#1c2328]">{value ?? "—"}</span>
                    <span className="mt-1 block text-[11.5px] text-[#5f6a70] group-hover:underline">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <button onClick={logout} className={`${btnSecondary} mt-8`}>
              Log out of Virm
            </button>
          </section>

          <section aria-labelledby="photo" className="border border-[#cbd7dc] bg-white/60">
            {changing || !hasPhoto ? (
              <div className="p-4 sm:p-6">
                <SavedPhotoSetup onSaved={() => setChanging(false)} onCancel={hasPhoto ? () => setChanging(false) : undefined} />
              </div>
            ) : (
              <div className="grid sm:grid-cols-[200px_1fr]">
                <div className="relative aspect-[3/4] bg-[#dfe6e9] sm:aspect-auto sm:min-h-[280px]">
                  <SavedPhotoImage className="absolute inset-0 h-full w-full object-cover object-top" />
                </div>
                <div className="flex flex-col p-6 sm:p-8">
                  <p id="photo" className={`${eyebrow} mb-2`}>Your saved try-on photo</p>
                  <p className="text-[13.5px] leading-relaxed text-[#5f6a70]">
                    Every try-on uses this photo. It&apos;s stored privately on your account and only you can see it.
                  </p>
                  <div className="mt-auto flex flex-wrap gap-3 pt-6">
                    <Link href="/try-on" className={btnPrimary}>Try On an Outfit</Link>
                    <button onClick={() => setChanging(true)} className={btnSecondary}>Change Photo</button>
                    <button onClick={removeSavedPhoto} className="min-h-[44px] px-2 text-[12.5px] font-semibold text-[#a03a2f] hover:underline">
                      Remove Photo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </PageShell>
    </main>
  );
}
