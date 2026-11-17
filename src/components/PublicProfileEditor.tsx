"use client";

import { PROFILE_PHOTO_EVENT } from "@/components/Nav";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BIO_MAX_CHARS, USERNAME_RULES } from "@/lib/profileRules";
import { btnPrimary, btnText, eyebrow } from "@/components/ui";

type Mine = { username: string | null; bio: string | null; displayName: string | null; avatarUrl: string | null };

/** Crops the picture to a centered square and shrinks it on this device (also drops the photo's location data). */
async function squarePicture(file: File, size = 400): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read that picture.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that picture."))), "image/webp", 0.86));
}

/** Profile: the public part (picture, @username, bio). Only these are ever shown to others. */
export function PublicProfileEditor() {
  const [mine, setMine] = useState<Mine | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [check, setCheck] = useState<{ name: string; problem: string | null } | null>(null);
  const [busy, setBusy] = useState<"save" | "picture" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/me/public-profile", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as Mine) : null))
      .then((m) => {
        if (!m) return;
        setMine(m);
        setUsername(m.username ?? "");
        setBio(m.bio ?? "");
      })
      .catch(() => {});
  }, []);

  // Is the username free? Checked shortly after typing stops.
  const typed = username.trim().replace(/^@+/, "").toLowerCase();
  useEffect(() => {
    if (!mine || !typed || typed === mine.username) return;
    const timer = setTimeout(() => {
      fetch(`/api/me/public-profile?check=${encodeURIComponent(typed)}`, { cache: "no-store" })
        .then((res) => res.json() as Promise<{ username: string; problem: string | null }>)
        .then((r) => setCheck({ name: r.username, problem: r.problem }))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [typed, mine]);

  if (!mine) return null;
  const nameChanged = typed !== (mine.username ?? "");
  const bioChanged = bio.trim() !== (mine.bio ?? "");
  const checked = check?.name === typed ? check : null;
  const blocked = nameChanged && (!typed || !checked || Boolean(checked.problem));

  async function save() {
    setBusy("save");
    setNote(null);
    const body: Record<string, string> = {};
    if (nameChanged) body.username = typed;
    if (bioChanged) body.bio = bio;
    const res = await fetch("/api/me/public-profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { username?: string | null; bio?: string | null; error?: string }) : {};
    if (res?.ok) {
      setMine({ ...mine!, username: data.username ?? null, bio: data.bio ?? null });
      setBio(data.bio ?? "");
      setNote("Saved");
    } else setNote(data.error ?? "Couldn't save. Please try again.");
    setBusy(null);
  }

  async function pickPicture(file: File) {
    setBusy("picture");
    setNote(null);
    try {
      const form = new FormData();
      form.append("picture", await squarePicture(file), "profile.webp");
      const res = await fetch("/api/me/avatar", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { avatarUrl?: string; error?: string };
      if (!res.ok || !data.avatarUrl) throw new Error(data.error ?? "Couldn't save that picture.");
      setMine({ ...mine!, avatarUrl: data.avatarUrl });
      window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_EVENT, { detail: data.avatarUrl }));
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn't save that picture.");
    }
    setBusy(null);
  }

  async function removePicture() {
    setBusy("picture");
    await fetch("/api/me/avatar", { method: "DELETE" }).catch(() => null);
    setMine({ ...mine!, avatarUrl: null });
    window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_EVENT, { detail: null }));
    setBusy(null);
  }

  return (
    <div className="mt-6 border-t border-black/[0.07] pt-6">
      <div className="flex items-center justify-between gap-3">
        <p className={eyebrow}>Public profile</p>
        {mine.username && (
          <Link href={`/u/${mine.username}`} className="text-[12.5px] font-semibold text-[#121821] underline-offset-4 hover:underline">
            View
          </Link>
        )}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy !== null}
          aria-label="Change profile picture"
          className="shrink-0 rounded-full disabled:opacity-60"
        >
          <Avatar url={mine.avatarUrl} name={mine.displayName ?? (typed || "?")} size={64} />
        </button>
        <div className="flex flex-wrap gap-x-4 text-[12.5px]">
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy !== null} className={btnText}>
            {busy === "picture" ? "Saving…" : mine.avatarUrl ? "Change picture" : "Add picture"}
          </button>
          {mine.avatarUrl && (
            <button type="button" onClick={removePicture} disabled={busy !== null} className={`${btnText} text-[#5d6874]`}>
              Remove
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void pickPicture(file);
          }}
        />
      </div>

      <label className="mt-4 block text-[12px] font-semibold text-[#4f5b66]">
        Username
        <span className="mt-1 flex items-center rounded-[12px] bg-white px-3 shadow-[inset_0_0_0_1px_rgba(18,24,33,0.16)] focus-within:shadow-[inset_0_0_0_2px_#121821]">
          <span className="text-[14px] text-[#5d6874]">@</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={24}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="yourname"
            className="h-11 min-w-0 flex-1 bg-transparent px-1 text-[14px] font-normal text-[#121821] outline-none"
          />
        </span>
      </label>
      <p className={`mt-1 min-h-[16px] text-[11.5px] ${checked?.problem ? "text-[#a03a2f]" : "text-[#5d6874]"}`}>
        {nameChanged && typed ? (checked ? (checked.problem ?? "✓ Available") : "Checking…") : !mine.username ? USERNAME_RULES : ""}
      </p>

      <label className="mt-2 block text-[12px] font-semibold text-[#4f5b66]">
        Bio
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX_CHARS))}
          rows={2}
          placeholder="Optional"
          className="mt-1 block w-full resize-none rounded-[12px] bg-white px-3 py-2.5 text-[14px] font-normal text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.16)] outline-none focus:shadow-[inset_0_0_0_2px_#121821]"
        />
      </label>
      <p className="mt-1 text-right text-[11px] text-[#5d6874]">
        {bio.length}/{BIO_MAX_CHARS}
      </p>

      {(nameChanged || bioChanged) && (
        <button onClick={save} disabled={busy !== null || blocked} className={`${btnPrimary} mt-2`}>
          {busy === "save" ? "Saving…" : "Save"}
        </button>
      )}
      {note && (
        <p role="status" className="mt-2 text-[12.5px] text-[#4f5b66]">
          {note}
        </p>
      )}
      <p className="mt-2 text-[11.5px] text-[#5d6874]">Only your picture, name, @username and bio are public. Never your email or closet.</p>
    </div>
  );
}
