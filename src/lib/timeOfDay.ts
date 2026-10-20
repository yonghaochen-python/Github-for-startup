/**
 * The page's look follows the visitor's local time of day, blending gradually like a real sky.
 *
 * A timeline of color "moments" through the day is blended minute by minute. Light-to-light changes (morning to
 * midday to afternoon) blend slowly over an hour. Day and night never meet at a mid-grey, where neither dark nor
 * light text reads well: the evening goes afternoon → soft dusk (still light) → a 4-second fade at 19:00 → deep
 * evening → full night, and dawn does the reverse around 5:00. Text turns light exactly at those two fades.
 */
export type Period = "morning" | "midday" | "afternoon" | "night";

export const PERIODS: Period[] = ["morning", "midday", "afternoon", "night"];

type Rgb = [number, number, number];
type Palette = { top: string; mid: string; bottom: string; glass: { shadow: Rgb; light: Rgb; sheen: Rgb; accent: Rgb } };

/** Page gradient (top, middle, bottom) and satin-glass tones (RGB 0–1) for each moment of the day. */
const PALETTES: Record<string, Palette> = {
  night: {
    top: "#0f141c",
    mid: "#141a26",
    bottom: "#1c1a31",
    glass: { shadow: [0.05, 0.07, 0.11], light: [0.2, 0.25, 0.36], sheen: [0.55, 0.62, 0.85], accent: [0.34, 0.27, 0.52] },
  },
  dawnDark: {
    top: "#182031",
    mid: "#1f2236",
    bottom: "#2a2335",
    glass: { shadow: [0.09, 0.11, 0.17], light: [0.3, 0.32, 0.46], sheen: [0.75, 0.7, 0.85], accent: [0.6, 0.42, 0.5] },
  },
  dawnLight: {
    top: "#f6e4e0",
    mid: "#efe6ea",
    bottom: "#e6ebf2",
    glass: { shadow: [0.55, 0.58, 0.72], light: [0.97, 0.84, 0.82], sheen: [1, 0.96, 0.94], accent: [0.95, 0.7, 0.7] },
  },
  morning: {
    top: "#fbebe1",
    mid: "#f4eeee",
    bottom: "#eaf0f6",
    glass: { shadow: [0.55, 0.63, 0.76], light: [0.98, 0.87, 0.8], sheen: [1, 0.97, 0.94], accent: [0.99, 0.76, 0.66] },
  },
  midday: {
    top: "#f8fafc",
    mid: "#f2f4f6",
    bottom: "#f4f5f6",
    glass: { shadow: [0.36, 0.48, 0.61], light: [0.79, 0.85, 0.91], sheen: [0.97, 0.98, 1], accent: [0.6, 0.6, 0.76] },
  },
  afternoon: {
    top: "#f8ecd9",
    mid: "#f4eee4",
    bottom: "#efebe5",
    glass: { shadow: [0.55, 0.47, 0.37], light: [0.95, 0.87, 0.74], sheen: [1, 0.97, 0.9], accent: [0.9, 0.72, 0.5] },
  },
  duskLight: {
    top: "#f3e3dc",
    mid: "#ece4ea",
    bottom: "#e3e2ee",
    glass: { shadow: [0.55, 0.5, 0.62], light: [0.95, 0.84, 0.82], sheen: [1, 0.95, 0.93], accent: [0.78, 0.62, 0.78] },
  },
  duskDark: {
    top: "#1b2030",
    mid: "#241f36",
    bottom: "#2c2238",
    glass: { shadow: [0.1, 0.11, 0.18], light: [0.32, 0.3, 0.45], sheen: [0.7, 0.65, 0.85], accent: [0.55, 0.35, 0.55] },
  },
};

/** [minute of the day, moment, star brightness 0–1]. Between two entries the colors blend; one minute apart = a fade. */
const TIMELINE: [number, string, number][] = [
  [0, "night", 1],
  [270, "night", 1], // 4:30 stars start fading
  [299, "dawnDark", 0], // 4:59
  [300, "dawnLight", 0], // 5:00 quick fade to light; text turns dark
  [330, "morning", 0], // 5:30
  [570, "morning", 0], // 9:30
  [630, "midday", 0], // 10:30
  [870, "midday", 0], // 14:30
  [930, "afternoon", 0], // 15:30
  [1110, "afternoon", 0], // 18:30 dusk begins
  [1139, "duskLight", 0], // 18:59
  [1140, "duskDark", 0], // 19:00 quick fade to dark; text turns light
  [1170, "night", 1], // 19:30 stars fully out
  [1440, "night", 1],
];

export type Sky = {
  period: Period;
  top: string;
  mid: string;
  bottom: string;
  glass: { shadow: number[]; light: number[]; sheen: number[]; accent: number[] };
  stars: number;
};

/**
 * The sky at a minute of the day. Self-contained plain JavaScript on purpose: its source is also inlined into the
 * <head> boot script, so the first paint already has the right colors.
 */
function virmSky(minute: number, P: Record<string, Palette>, T: [number, string, number][]): Sky {
  let i = 0;
  while (i < T.length - 2 && minute >= T[i + 1][0]) i++;
  const a = T[i];
  const b = T[i + 1];
  const span = b[0] - a[0];
  let f = span > 0 ? Math.min(1, Math.max(0, (minute - a[0]) / span)) : 1;
  f = f * f * (3 - 2 * f);
  const A = P[a[1]];
  const B = P[b[1]];
  const hex = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const mixHex = (x: string, y: string) => {
    const p = hex(x);
    const q = hex(y);
    return "rgb(" + p.map((v, k) => Math.round(v + (q[k] - v) * f)).join(" ") + ")";
  };
  const mix = (x: number[], y: number[]) => x.map((v, k) => v + (y[k] - v) * f);
  const period: Period = minute < 300 ? "night" : minute < 600 ? "morning" : minute < 900 ? "midday" : minute < 1140 ? "afternoon" : "night";
  return {
    period,
    top: mixHex(A.top, B.top),
    mid: mixHex(A.mid, B.mid),
    bottom: mixHex(A.bottom, B.bottom),
    glass: {
      shadow: mix(A.glass.shadow, B.glass.shadow),
      light: mix(A.glass.light, B.glass.light),
      sheen: mix(A.glass.sheen, B.glass.sheen),
      accent: mix(A.glass.accent, B.glass.accent),
    },
    stars: a[2] + (b[2] - a[2]) * f,
  };
}

/** Puts a sky on the page: CSS colors (which fade over 4s), the period for text colors, and a note for the glass. */
function applySky(sky: Sky) {
  const html = document.documentElement;
  html.style.setProperty("--page-top", sky.top);
  html.style.setProperty("--page-mid", sky.mid);
  html.style.setProperty("--page-bottom", sky.bottom);
  html.style.setProperty("--page", sky.mid);
  html.style.setProperty("--stars", String(Math.round(sky.stars * 100) / 100));
  if (html.dataset.period !== sky.period) html.dataset.period = sky.period;
  (window as unknown as { __virmSky?: Sky }).__virmSky = sky;
  window.dispatchEvent(new Event("virm-sky"));
}

/**
 * The minute of the day to show: the real local time, or a preview. `?period=night` (etc.) or `?time=19:05`
 * previews a moment in this tab; `?period=auto` or `?time=auto` goes back to the real time.
 */
function skyMinute(): number {
  try {
    const params = new URLSearchParams(location.search);
    const period = params.get("period");
    const time = params.get("time");
    if (period === "auto" || time === "auto") {
      sessionStorage.removeItem("virm-period");
      sessionStorage.removeItem("virm-time");
    }
    if (period && period !== "auto") {
      sessionStorage.setItem("virm-period", period);
      sessionStorage.removeItem("virm-time");
    }
    if (time && /^\d{1,2}:\d{2}$/.test(time)) {
      sessionStorage.setItem("virm-time", time);
      sessionStorage.removeItem("virm-period");
    }
    const previewTime = sessionStorage.getItem("virm-time");
    if (previewTime) {
      const [h, m] = previewTime.split(":").map(Number);
      return Math.min(1439, h * 60 + m);
    }
    const previewPeriod = sessionStorage.getItem("virm-period") as Period | null;
    const fixed = previewPeriod ? { morning: 480, midday: 750, afternoon: 1020, night: 0 }[previewPeriod] : undefined;
    if (fixed !== undefined) return fixed;
  } catch {}
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** The sky right now (or the previewed moment). */
export function currentSky(): Sky {
  return virmSky(skyMinute(), PALETTES, TIMELINE);
}

/** Re-reads the time and updates the page. */
export function refreshSky() {
  applySky(currentSky());
}

/** Runs in <head> before the page paints, so the right colors show from the first frame. */
export const SKY_BOOT_SCRIPT = `(function(){try{var P=${JSON.stringify(PALETTES)},T=${JSON.stringify(TIMELINE)};var virmSky=${virmSky.toString()};var applySky=${applySky.toString()};var skyMinute=${skyMinute.toString()};applySky(virmSky(skyMinute(),P,T))}catch(e){document.documentElement.setAttribute('data-period','midday')}})();`;
