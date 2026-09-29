"use client";

import { useEffect, useState } from "react";

export function DemoModeBanner() {
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/config")
      .then((res) => res.json() as Promise<{ aiEnabled?: boolean }>)
      .then((data) => {
        if (!ignore) setAiEnabled(Boolean(data.aiEnabled));
      });
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
