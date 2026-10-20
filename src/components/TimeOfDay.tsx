"use client";

import { useEffect, useState } from "react";
import { PERIOD_LABEL, periodAt, previewPeriod, type Period } from "@/lib/timeOfDay";

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

/** The current period, following <html data-period> (null before the page has mounted). */
export function usePeriod(): Period | null {
  const [period, setPeriod] = useState<Period | null>(null);
  useEffect(() => {
    const html = document.documentElement;
    const read = () => setPeriod((html.dataset.period as Period) ?? null);
    read();
    const observer = new MutationObserver(read);
    observer.observe(html, { attributes: true, attributeFilter: ["data-period"] });
    return () => observer.disconnect();
  }, []);
  return period;
}

/** A small label with the current period and local time, e.g. "Night · 9:41 PM". */
export function AmbientTime({ className = "" }: { className?: string }) {
  const period = usePeriod();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the time is only known in the browser
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  if (!period || !now) return <span className={`inline-block h-[22px] ${className}`} aria-hidden />;
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <span className={`ambient-time inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium ${className}`}>
      <span className="ambient-dot h-1.5 w-1.5 rounded-full" aria-hidden />
      {PERIOD_LABEL[period]} · <time dateTime={now.toISOString()}>{time}</time>
    </span>
  );
}
