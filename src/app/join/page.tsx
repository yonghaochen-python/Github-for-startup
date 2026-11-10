"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { savePendingInvite } from "@/lib/pendingInvite";
import { INVITE_TRIAL_DAYS } from "@/lib/plans";
import { PageShell, btnPrimary, btnSecondary, eyebrow } from "@/components/ui";

/**
 * A friend's invite link (/join?code=VIRM-…). The code is kept in this browser; new people create an account with it
 * filled in, and signed-in people go straight to the trial page, which uses it.
 */
function Join() {
  const params = useSearchParams();
  const router = useRouter();
  const { status } = useAuth();
  const code = (params.get("code") ?? "").trim().toUpperCase();

  // Checked before it's kept, so a mistyped link says so here instead of at sign-up.
  const [valid, setValid] = useState<boolean | null>(null);
  useEffect(() => {
    if (!code) return;
    let gone = false;
    fetch(`/api/invite/check?code=${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(async (res) => ((await res.json()) as { valid: boolean; code: string | null }))
      .then((r) => {
        if (gone) return;
        setValid(r.valid);
        if (r.valid && r.code) savePendingInvite(r.code);
      })
      .catch(() => !gone && setValid(false));
    return () => {
      gone = true;
    };
  }, [code]);
  useEffect(() => {
    if (status === "signedIn" && valid) router.replace("/trial");
  }, [status, valid, router]);

  return (
    <div className="max-w-xl pt-10 sm:pt-14">
      <p className={eyebrow}>An invite from a friend</p>
      <h1 className="mt-3 font-display text-[40px] font-normal leading-[1] tracking-[-1.2px] text-[#121821] sm:text-[56px]">
        {INVITE_TRIAL_DAYS} days of VIRM Plus, free.
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-[#4f5b66]">
        Your digital closet, outfit ideas and AI try-on. Your friend&apos;s code gives you a {INVITE_TRIAL_DAYS}-day Plus trial: $0 today, and no
        automatic charge when it ends.
      </p>
      {code && valid && <p className="mt-4 text-[13px] text-[#5d6874]">Code: {code}</p>}
      {(!code || valid === false) && (
        <p className="mt-4 text-[13px] text-[#8a4b12]">This invite code isn&apos;t valid. Ask your friend to check it, or start with the 7-day trial.</p>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/login?create=1" className={btnPrimary}>
          Create my account
        </Link>
        <Link href="/login" className={btnSecondary}>
          I have an account
        </Link>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <main className="flex-1 pb-20">
      <PageShell>
        <Suspense fallback={null}>
          <Join />
        </Suspense>
      </PageShell>
    </main>
  );
}
