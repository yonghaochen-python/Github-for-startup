import Link from "next/link";
import { ArrowLeftIcon } from "@/components/Icons";

/** "← My Style" at the top of the pages My Style opens (Planner, AI Stylist, Saved), to get back. */
export function BackToMyStyle({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`-ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-semibold text-[#4f5b66] hover:bg-black/5 hover:text-[#121821] ${className}`}
    >
      <ArrowLeftIcon className="h-4 w-4" /> My Style
    </Link>
  );
}
