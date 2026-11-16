"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import type { FollowState } from "@/lib/postRules";

/**
 * Follow / Following for one person. Shows at once and is put back if it can't be saved. Signed-out visitors are
 * asked to sign up. `tone`: "dark" on pictures (the phone feed), "light" on the page.
 */
export function FollowButton({
  username,
  followed,
  tone = "light",
  onChange,
}: {
  username: string;
  followed: boolean;
  tone?: "light" | "dark";
  onChange?: (state: FollowState | null, followed: boolean) => void;
}) {
  const { status } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [on, setOn] = useState(followed);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (status !== "signedIn") {
      showToast("Sign up to follow people", { label: "Sign up", onClick: () => router.push("/login?create=1") }, { check: false });
      return;
    }
    const next = !on;
    setOn(next);
    setBusy(true);
    const res = await fetch(`/api/profiles/${encodeURIComponent(username)}/follow`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ follow: next }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setOn(!next);
      return showToast("Couldn't save that. Please try again.");
    }
    onChange?.((await res.json()) as FollowState, next);
  }

  const style =
    tone === "dark"
      ? on
        ? "bg-white/15 text-white ring-1 ring-white/30"
        : "bg-white text-[#121821]"
      : on
        ? "bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.16)]"
        : "bg-[#121821] text-white";
  return (
    <button onClick={toggle} disabled={busy} aria-pressed={on} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${style}`}>
      {on ? "Following" : "Follow"}
    </button>
  );
}
