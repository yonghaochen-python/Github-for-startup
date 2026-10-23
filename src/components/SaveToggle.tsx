"use client";

/** A small on/off bookmark: filled red when the look is saved, white when it isn't. */
export function SaveToggle({
  saved,
  busy = false,
  onToggle,
  className = "h-10 w-10",
}: {
  saved: boolean;
  busy?: boolean;
  onToggle: () => void;
  /** Size (and any extras); a 40px circle by default. */
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Saved. Tap to unsave" : "Save look"}
      title={saved ? "Saved" : "Save"}
      className={`btn-tactile inline-flex ${className} shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
        saved
          ? "bg-[#d93a2b] text-white shadow-[0_6px_16px_rgba(217,58,43,0.28)] hover:bg-[#c23123]"
          : "bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:bg-[#f4f5f6]"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
        <path
          d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
