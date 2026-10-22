"use client";

import { LiveTryOn } from "@/components/LiveTryOn";
import { PageShell } from "@/components/ui";

/** Live Try On (preview): a live camera mirror beside the closet. A UI prototype; no AI runs here. */
export default function LivePage() {
  return (
    <main className="flex-1 pb-16">
      <PageShell className="pt-8">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[2.2px] text-[#5d6874]">Preview</p>
          <h1 className="font-display text-[40px] leading-tight text-[#121821] sm:text-[52px]">Live</h1>
        </div>
        <LiveTryOn />
      </PageShell>
    </main>
  );
}
