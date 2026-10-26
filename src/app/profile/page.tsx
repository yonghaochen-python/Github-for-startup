"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { MAX_DISPLAY_NAME } from "@/lib/displayName";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { CurrentLookBar, MirrorImage, SavedPhotoSetup, useRemoveSavedPhoto } from "@/components/SavedPhoto";
import { BookmarkIcon, ClosetIcon, SparkleIcon } from "@/components/Icons";
import { ErrorNote, PageHeader, PageShell, btnPrimary, btnSecondary, btnText, eyebrow } from "@/components/ui";
import { resetTips } from "@/components/Tips";

type Outfit = { id: string; isFavorite: boolean };

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
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
    { label: "Outfits created", value: outfitCount, href: "/outfits/saved", Icon: SparkleIcon },
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
              <p className="mt-1 text-[12px] text-[#5d6874]">Used to log in. Can&apos;t be changed.</p>
            </div>
            <div className="mt-6">
              <p className={eyebrow}>Plan</p>
              <p className="mt-1.5 text-[15px] text-[#121821]">
                Free ·{" "}
                <Link href="/pricing" className="text-[13px] font-semibold underline-offset-4 hover:underline">
                  See plans
                </Link>
              </p>
            </div>
            <ul className="mt-8 grid grid-cols-3 gap-3 border-t border-black/[0.07] pt-6">
              {stats.map(({ label, value, href, Icon }) => (
                <li key={label}>
                  <Link href={href} className="group block">
                    <Icon className="mb-2 h-4 w-4 text-[#5d6874]" />
                    <span className="block font-display text-[34px] leading-none text-[#121821]">{value ?? "—"}</span>
                    <span className="mt-1 block text-[11.5px] text-[#4f5b66] group-hover:underline">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button onClick={logout} className={btnSecondary}>
                Log out of Virm
              </button>
              <button
                onClick={() => {
                  resetTips();
                  showToast("Tips will show again on each page");
                }}
                className="text-[13px] font-semibold text-[#3b4850] underline-offset-4 hover:text-[#121821] hover:underline"
              >
                Show tips again
              </button>
            </div>
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
                  <p id="photo" className={`${eyebrow} mb-2`}>Try-on photo</p>
                  <p className="text-[13.5px] leading-relaxed text-[#4f5b66]">
                    Every try-on uses this photo. Only you can see it.
                  </p>
                  <div className="mt-auto flex flex-wrap gap-3 pt-6">
                    <Link href="/studio" className={btnPrimary}>Open Studio</Link>
                    <button onClick={() => setChanging(true)} className={btnSecondary}>Change Photo</button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                    <CurrentLookBar />
                    <button onClick={removeSavedPhoto} className="font-semibold text-[#a03a2f] underline-offset-4 hover:underline">
                      Remove photo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
        <DeleteAccount />
      </PageShell>
    </main>
  );
}

/** Permanently delete the account, after typing the password. */
function DeleteAccount() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't delete your account right now.");
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account right now.");
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="delete-account" className="mt-8 rounded-[22px] bg-white p-6 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] sm:p-8">
      <h2 id="delete-account" className="text-[15px] font-semibold text-[#121821]">
        Delete account
      </h2>
      <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-[#4f5b66]">
        Permanently deletes your account, closet, photos, try-ons and saved looks. This can&apos;t be undone.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-4 text-[13px] font-semibold text-[#a03a2f] underline-offset-4 hover:underline">
          Delete my account
        </button>
      ) : (
        <form onSubmit={remove} className="mt-4 flex max-w-md flex-col gap-3">
          <label htmlFor="delete-password" className="text-[12.5px] font-semibold text-[#3b4850]">
            Type your password to confirm
          </label>
          <input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-full bg-white px-5 text-[14px] text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.18)] outline-none focus:shadow-[inset_0_0_0_2px_#a03a2f]"
          />
          {error && <ErrorNote message={error} />}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || !password}
              className="btn-tactile inline-flex min-h-[46px] items-center rounded-full bg-[#a03a2f] px-6 text-[13.5px] font-semibold text-white hover:bg-[#8a3127] disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete forever"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setPassword(""); setError(null); }} className={btnText}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
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
          <p className={`font-display text-[32px] leading-tight ${current ? "text-[#121821]" : "text-[#5d6874]"}`}>
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
      <p className="mt-1.5 text-[12px] text-[#5d6874]">Shown in Virm. Leave empty to remove it.</p>
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
