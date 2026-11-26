"use client";

import { useEffect, useState } from "react";
import { LandingShop } from "@/components/landing/LandingShop";
import { LandingWardrobe } from "@/components/landing/LandingWardrobe";
import { isLandingVariant, LANDING_COOKIE, LANDING_COOKIE_DAYS, LANDING_VARIANTS, type LandingStep, type LandingVariant } from "@/lib/landingTest";

/**
 * Signed out on "/" while the landing test is on: shows landing A (shopping, female model) or B (your wardrobe,
 * male model), picked at random the first time and kept in a cookie after that. Counts each step once per browser:
 * saw it, tapped Try It Free, tapped Create Account (sign-ups are counted on the server from the cookie).
 * Add ?landing=a or ?landing=b to the address to look at one without being counted.
 */
export function LandingTest() {
  // Shown only after sign-in status is known (in the browser), so the pick can be made right away.
  const [{ variant, preview }] = useState(pickVariant);

  useEffect(() => {
    if (!variant || preview) return;
    document.cookie = `${LANDING_COOKIE}=${variant}; path=/; max-age=${LANDING_COOKIE_DAYS * 86400}; samesite=lax`;
    send(variant, "view");
  }, [variant, preview]);

  if (!variant) return <main className="flex-1" />;

  // Taps on Try It Free and Create Account.
  function onClickCapture(e: React.MouseEvent) {
    if (preview) return;
    const href = (e.target as HTMLElement).closest("a")?.getAttribute("href") ?? "";
    if (href.startsWith("/try")) send(variant!, "try");
    else if (href.startsWith("/login?create=1")) send(variant!, "create");
  }

  return (
    <div className="flex flex-1 flex-col" onClickCapture={onClickCapture}>
      {variant === "a" ? <LandingShop /> : <LandingWardrobe />}
    </div>
  );
}

/** The page this browser saw before, or a new random one; ?landing=a|b previews one without counting. */
function pickVariant(): { variant: LandingVariant | null; preview: boolean } {
  if (typeof document === "undefined") return { variant: null, preview: false };
  const asked = new URLSearchParams(window.location.search).get("landing");
  if (isLandingVariant(asked)) return { variant: asked, preview: true };
  const saved = document.cookie.match(new RegExp(`(?:^|; )${LANDING_COOKIE}=([^;]*)`))?.[1];
  return { variant: isLandingVariant(saved) ? saved : LANDING_VARIANTS[Math.random() < 0.5 ? 0 : 1], preview: false };
}

/** Once per browser per step (remembered on this device; if storage is blocked it may count again). */
function send(variant: LandingVariant, step: LandingStep) {
  const key = `virm-landing-${variant}-${step}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    // Storage blocked: count anyway.
  }
  fetch("/api/analytics/landing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant, step }),
    keepalive: true,
  }).catch(() => {});
}
