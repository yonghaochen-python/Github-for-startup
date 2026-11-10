"use client";

/** A friend's code from a /join link, kept in this browser until it's used at sign-up or on the trial page. */
const KEY = "virm-invite-code";

export function savePendingInvite(code: string): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {}
}

export function pendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Uses a code for the signed-in account. Returns null when it worked, otherwise the message to show. */
export async function redeemInvite(code: string): Promise<string | null> {
  const res = await fetch("/api/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
  if (!res) return "Couldn't reach Virm. Check your connection and try again.";
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong. Please try again.";
}
