/** Quiet in-page loading state for ordinary navigation — the branded full-screen LoadingScreen is reserved for auth. */
export function InlineLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-[40vh] items-center justify-center text-[10px] font-bold uppercase tracking-[3px] text-[#9aa2a6]"
    >
      Loading…
    </div>
  );
}
