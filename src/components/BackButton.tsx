"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@/components/Icons";

/** A round back arrow: the page before (inside Virm), or `fallback` when this page was opened directly. */
export function BackButton({ fallback = "/feed", disabled = false }: { fallback?: string; disabled?: boolean }) {
  const router = useRouter();
  function back() {
    const fromVirm = typeof document !== "undefined" && document.referrer.startsWith(location.origin);
    if (fromVirm && window.history.length > 1) router.back();
    else router.push(fallback);
  }
  return (
    <button
      type="button"
      onClick={back}
      disabled={disabled}
      aria-label="Back"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] disabled:opacity-40"
    >
      <ArrowLeftIcon className="h-5 w-5" />
    </button>
  );
}
