"use client";

import { useEffect } from "react";
import { refreshSky } from "@/lib/timeOfDay";

/** Keeps the page's sky in step with the visitor's local time, updating once a minute. Renders nothing. */
export function TimeOfDaySync() {
  useEffect(() => {
    refreshSky();
    let interval: ReturnType<typeof setInterval> | undefined;
    // Line up with the start of each minute, then update once a minute; the colors fade between updates.
    const first = setTimeout(() => {
      refreshSky();
      interval = setInterval(refreshSky, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, []);
  return null;
}
