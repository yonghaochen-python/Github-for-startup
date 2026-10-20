"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ErrorNote, PageShell, btnPrimary } from "@/components/ui";

const MIN_PASSWORD = 8;
const field =
  "h-12 w-full rounded-full bg-white px-5 text-[14px] text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] outline-none placeholder:text-[#8a96a1] focus:shadow-[inset_0_0_0_2px_#121821]";

/** Opened from a one-time reset link: choose a new password. */
export default function ResetPasswordPage() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't change the password. Please try again.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 pb-16">
      <PageShell className="flex justify-center pt-14 sm:pt-20">
        <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] sm:p-8">
          <h1 className="font-display text-[36px] font-normal leading-tight text-[#121821]">
            {done ? "Password changed" : "Choose a new password"}
          </h1>
          {done ? (
            <>
              <p className="mt-2 text-[14px] text-[#4f5b66]">Log in with your email and new password.</p>
              <Link href="/login" className={`${btnPrimary} mt-6 w-full`}>
                Log in
              </Link>
            </>
          ) : !token ? (
            <p className="mt-2 text-[14px] text-[#4f5b66]">This page needs the full reset link. Ask for a new one.</p>
          ) : (
            <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
              <label className="sr-only" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (8+ characters)"
                className={field}
              />
              <label className="sr-only" htmlFor="confirm-password">
                Type it again
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                className={field}
              />
              {error && <ErrorNote message={error} />}
              <button type="submit" disabled={saving} className={`${btnPrimary} mt-2 w-full`}>
                {saving ? "Saving…" : "Save new password"}
              </button>
              <p className="text-[12px] text-[#5d6874]">This signs you out on every other device.</p>
            </form>
          )}
        </div>
      </PageShell>
    </main>
  );
}
