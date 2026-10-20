"use client";

import { useEffect } from "react";
import { periodAt, previewPeriod } from "@/lib/timeOfDay";

/** Keeps <html data-period> in step with the visitor's local time, checking every minute. Renders nothing. */
export function TimeOfDaySync() {
  useEffect(() => {
    const apply = () => {
      const period = previewPeriod() ?? periodAt(new Date());
      if (document.documentElement.dataset.period !== period) document.documentElement.dataset.period = period;
    };
    apply();
    let interval: ReturnType<typeof setInterval> | undefined;
    // Line up with the start of each minute, then check once a minute.
    const first = setTimeout(() => {
      apply();
      interval = setInterval(apply, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, []);
  return null;
}
