"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { MAX_DISPLAY_NAME } from "@/lib/displayName";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { CurrentLookBar, MirrorImage, SavedPhotoSetup, useRemoveSavedPhoto } from "@/components/SavedPhoto";
import { BookmarkIcon, ClosetIcon, SparkleIcon } from "@/components/Icons";
import { ErrorNote, PageHeader, PageShell, btnPrimary, btnSecondary, btnText, eyebrow } from "@/components/ui";

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
        <PageHeader title="Profile" description="Your account and try-on photo." />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section aria-labelledby="account" className="rounded-[22px] bg-white p-6 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] sm:p-8">
            <h2 id="account" className="sr-only">Account</h2>
            <NameEditor />
            <div className="mt-6">
              <p className={eyebrow}>Email</p>
              <p className="mt-1.5 break-all text-[15px] text-[#121821]">{user?.email ?? "…"}</p>
              <p className="mt-1 text-[12px] text-[#6b7783]">Used to log in. Can&apos;t be changed.</p>
            </div>
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

          <section aria-labelledby="photo" className="overflow-hidden rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]">
            {changing || !hasPhoto ? (
              <div className="p-4 sm:p-6">
                <SavedPhotoSetup onSaved={() => setChanging(false)} onCancel={hasPhoto ? () => setChanging(false) : undefined} />
              </div>
            ) : (
              <div className="grid sm:grid-cols-[200px_1fr]">
                <div className="relative aspect-[3/4] bg-[#dfe6e9] sm:aspect-auto sm:min-h-[280px]">
                  <MirrorImage className="absolute inset-0 h-full w-full object-cover object-top" />
                </div>
                <div className="flex flex-col p-6 sm:p-8">
                  <p id="photo" className={`${eyebrow} mb-2`}>Your saved try-on photo</p>
                  <p className="text-[13.5px] leading-relaxed text-[#5f6a70]">
                    Every try-on uses this photo. Only you can see it.
                  </p>
                  <div className="mt-3">
                    <CurrentLookBar />
                  </div>
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

/** The person's name as shown in Virm: view it, or edit and save it. The login email is not editable. */
function NameEditor() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = user?.displayName ?? "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your name. Please try again.");
      await refreshUser();
      setEditing(false);
      showToast(value.trim() ? "Name saved" : "Name removed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your name. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div>
        <p className={eyebrow}>Name</p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className={`font-display text-[32px] leading-tight ${current ? "text-[#121821]" : "text-[#8a96a1]"}`}>
            {current || "No name yet"}
          </p>
          <button
            onClick={() => {
              setValue(current);
              setEditing(true);
            }}
            className={btnText}
          >
            {current ? "Edit" : "Add your name"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save}>
      <label htmlFor="display-name" className={eyebrow}>
        Name
      </label>
      <input
        id="display-name"
        autoFocus
        autoComplete="name"
        maxLength={MAX_DISPLAY_NAME}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What should Virm call you?"
        className="mt-2 min-h-[46px] w-full rounded-full bg-[#f4f5f6] px-5 text-[15px] text-[#121821] outline-none focus:shadow-[0_0_0_2px_#121821]"
      />
      <p className="mt-1.5 text-[12px] text-[#6b7783]">Shown in Virm. Leave empty to remove it.</p>
      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
