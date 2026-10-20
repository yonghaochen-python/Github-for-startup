/** The page's look follows the visitor's local time of day. */
export type Period = "morning" | "midday" | "afternoon" | "night";

export const PERIODS: Period[] = ["morning", "midday", "afternoon", "night"];

export const PERIOD_LABEL: Record<Period, string> = {
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  night: "Night",
};

/** Morning 5:00–9:59, midday 10:00–14:59, afternoon 15:00–18:59, night 19:00–4:59. */
export function periodAt(date: Date): Period {
  const h = date.getHours();
  if (h >= 5 && h < 10) return "morning";
  if (h >= 10 && h < 15) return "midday";
  if (h >= 15 && h < 19) return "afternoon";
  return "night";
}

/** Colors for the satin glass in each period (RGB 0–1): its shadow, light, sheen and accent tones. */
export const GLASS_PALETTE: Record<Period, { shadow: number[]; light: number[]; sheen: number[]; accent: number[]; fallback: string }> = {
  morning: {
    shadow: [0.55, 0.63, 0.76],
    light: [0.98, 0.87, 0.8],
    sheen: [1, 0.97, 0.94],
    accent: [0.99, 0.76, 0.66],
    fallback: "radial-gradient(120% 90% at 30% 25%, #fde9dc 0%, #e9d9d6 45%, #9fb0c6 100%)",
  },
  midday: {
    shadow: [0.36, 0.48, 0.61],
    light: [0.79, 0.85, 0.91],
    sheen: [0.97, 0.98, 1],
    accent: [0.6, 0.6, 0.76],
    fallback: "radial-gradient(120% 90% at 30% 25%, #e3ebf2 0%, #c7d4e0 45%, #8fa3b8 100%)",
  },
  afternoon: {
    shadow: [0.55, 0.47, 0.37],
    light: [0.95, 0.87, 0.74],
    sheen: [1, 0.97, 0.9],
    accent: [0.9, 0.72, 0.5],
    fallback: "radial-gradient(120% 90% at 30% 25%, #f6e7cf 0%, #e3cfae 45%, #a8927a 100%)",
  },
  night: {
    shadow: [0.05, 0.07, 0.11],
    light: [0.2, 0.25, 0.36],
    sheen: [0.55, 0.62, 0.85],
    accent: [0.34, 0.27, 0.52],
    fallback: "radial-gradient(120% 90% at 30% 25%, #2a3348 0%, #171d2b 50%, #0c1018 100%)",
  },
};

/**
 * Runs in <head> before the page paints, so the right colors show from the first frame. `?period=night` (etc.)
 * previews a period for this browser tab; `?period=auto` goes back to the real time.
 */
export const PERIOD_BOOT_SCRIPT = `(function(){try{var q=new URLSearchParams(location.search).get('period');var ok=['morning','midday','afternoon','night'];if(q==='auto'){sessionStorage.removeItem('virm-period')}else if(ok.indexOf(q)>=0){sessionStorage.setItem('virm-period',q)}var f=sessionStorage.getItem('virm-period');var h=new Date().getHours();var p=ok.indexOf(f)>=0?f:h>=5&&h<10?'morning':h>=10&&h<15?'midday':h>=15&&h<19?'afternoon':'night';document.documentElement.setAttribute('data-period',p)}catch(e){document.documentElement.setAttribute('data-period','midday')}})();`;

/** A period chosen with ?period= for this tab, if any. */
export function previewPeriod(): Period | null {
  try {
    const value = sessionStorage.getItem("virm-period");
    return PERIODS.includes(value as Period) ? (value as Period) : null;
  } catch {
    return null;
  }
}
