"use client";

import { useEffect, useState } from "react";
import { fetchWithRetry } from "@/lib/fetchRetry";

export function DemoModeBanner() {
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let ignore = false;
    // Only a real answer counts: a request that failed must not show the demo banner.
    fetchWithRetry("/api/config")
      .then((res) => (res.ok ? (res.json() as Promise<{ aiEnabled?: boolean }>) : null))
      .then((data) => {
        if (!ignore && data) setAiEnabled(Boolean(data.aiEnabled));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  if (aiEnabled !== false) return null;

  return (
    <div className="bg-amber-50 px-6 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      Demo mode — no ANTHROPIC_API_KEY set, so uploads and outfits use placeholder data instead of real AI. Add a
      key to <code className="font-mono">.env.local</code> to go live.
    </div>
  );
}
