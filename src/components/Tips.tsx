"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * First-visit tips: a small bubble beside the thing to tap, with a soft ring around it. Each page's tips show once
 * per device (remembered in this browser); "Show tips again" in Profile brings them back. A step whose target
 * isn't on the page (e.g. no saved looks yet) is skipped.
 */

export type Tip = { target: string; text: string };

const KEY_PREFIX = "virm-tips-seen:";
const TIP_VERSION = "1";

function seen(id: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + id) === TIP_VERSION;
  } catch {
    return true; // No storage (private mode): don't nag on every visit.
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(KEY_PREFIX + id, TIP_VERSION);
  } catch {}
}

/** Clears every page's "seen" mark so the tips show again. */
export function resetTips() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(KEY_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}

const BUBBLE_W = 260;

/** The first matching element that's actually shown (menu links exist in both the top bar and the phone tab bar). */
function findTarget(selector: string): Element | null {
  return (
    Array.from(document.querySelectorAll(selector)).find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) ?? null
  );
}

/** Menu bars stay put while the page scrolls, so there's nothing to scroll to. */
const inFixedBar = (el: Element) => Boolean(el.closest(".site-nav, .site-tabbar"));
const GAP = 12;

export function Tips({ id, tips, delay = 900 }: { id: string; tips: Tip[]; delay?: number }) {
  const [steps, setSteps] = useState<Tip[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // After the page settles, keep only the tips whose targets exist, then start (once per device).
  useEffect(() => {
    if (seen(id)) return;
    // Wait for the page's content (it may still be loading), up to a few seconds, then start with what's there.
    const started = Date.now();
    let timer = setTimeout(function check() {
      const present = tips.filter((t) => findTarget(t.target));
      if (present.length === tips.length || Date.now() - started > delay + 6000) {
        if (present.length) setSteps(present);
        return;
      }
      timer = setTimeout(check, 300);
    }, delay);
    return () => clearTimeout(timer);
  }, [id, tips, delay]);

  const step = steps?.[index];

  const measure = useCallback(() => {
    if (!step) return;
    const el = findTarget(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (el && !inFixedBar(el)) {
      const r = el.getBoundingClientRect();
      const fits = r.height < window.innerHeight - 260;
      window.scrollTo({ top: window.scrollY + r.top - (fits ? (window.innerHeight - r.height) / 2 : 100), behavior: "smooth" });
    }
    const frame = requestAnimationFrame(measure);
    const timer = setTimeout(measure, 450);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, measure]);

  const close = useCallback(() => {
    markSeen(id);
    setSteps(null);
  }, [id]);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, close]);

  if (!steps || !step || !rect) return null;

  const last = index === steps.length - 1;
  const vw = window.innerWidth;
  // Leave room for the sticky menu bar at the top and, on phones, the tab bar at the bottom.
  const topEdge = 84;
  const bottomEdge = window.innerHeight - (vw < 768 ? 84 : 16);
  const width = Math.min(BUBBLE_W, vw - 32);
  const need = 140;
  // Below the target if it fits, else above, else (for a tall panel) inside its top edge.
  const place: "below" | "above" | "inside" =
    rect.bottom + GAP + need <= bottomEdge ? "below" : rect.top - GAP - need >= topEdge ? "above" : "inside";
  const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), vw - width - 16);
  const arrowLeft = Math.min(Math.max(18, rect.left + rect.width / 2 - left), width - 18);
  const position =
    place === "below"
      ? { left, top: rect.bottom + GAP, width }
      : place === "above"
        ? { left, top: rect.top - GAP, width, transform: "translateY(-100%)" }
        : { left, top: Math.max(rect.top, topEdge) + 16, width };

  return createPortal(
    <>
      {/* Soft ring around the thing the tip is about. */}
      <div
        aria-hidden
        className="tip-ring pointer-events-none fixed z-[60] rounded-[18px]"
        style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
      />
      <div
        role="dialog"
        aria-live="polite"
        aria-label={`Tip ${index + 1} of ${steps.length}`}
        className="tip-bubble fixed z-[61] rounded-[16px] px-4 pb-3 pt-3.5 text-[13.5px] leading-snug"
        style={position}
      >
        {place !== "inside" && (
          <span
            aria-hidden
            className="tip-arrow absolute h-3 w-3 rotate-45"
            style={place === "below" ? { left: arrowLeft - 6, top: -6 } : { left: arrowLeft - 6, bottom: -6 }}
          />
        )}
        <p className="relative">{step.text}</p>
        <div className="relative mt-3 flex items-center gap-3">
          {steps.length > 1 && (
            <span className="tip-count text-[11.5px]">
              {index + 1} / {steps.length}
            </span>
          )}
          {!last && (
            <button onClick={close} className="tip-skip ml-auto text-[12.5px] font-semibold underline-offset-4 hover:underline">
              Skip
            </button>
          )}
          <button
            onClick={() => (last ? close() : setIndex(index + 1))}
            autoFocus
            className={`tip-next rounded-full px-4 py-1.5 text-[12.5px] font-semibold ${last ? "ml-auto" : ""}`}
          >
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
