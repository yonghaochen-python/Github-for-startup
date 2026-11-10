"use client";

import { useEffect, useState } from "react";

/**
 * A button that asks right where it is, instead of the browser's pop-up: the first tap turns it into
 * "Question  Yes · Cancel"; it goes back by itself after a few seconds. For removing things that can't be put back
 * quickly, and for starting paid AI work, which must never happen by accident.
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  className = "",
  disabled = false,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => unknown;
  className?: string;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setAsking(false), 6000);
    return () => clearTimeout(timer);
  }, [asking]);

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} disabled={disabled} className={className}>
        {label}
      </button>
    );
  }
  return (
    <span role="group" aria-label={question} className="inline-flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
      <span className="text-[#4f5b66]">{question}</span>
      <button
        type="button"
        autoFocus
        onClick={() => {
          setAsking(false);
          void onConfirm();
        }}
        className="rounded-full bg-[#121821] px-3.5 py-1.5 font-semibold text-white"
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="font-medium text-[#4f5b66] underline-offset-4 hover:underline">
        Cancel
      </button>
    </span>
  );
}
