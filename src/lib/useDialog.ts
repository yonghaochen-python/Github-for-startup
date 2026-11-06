"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behavior for a window over the page (a dialog): focus moves into it when it opens, Tab and Shift+Tab stay
 * inside it, Escape closes it (unless `escape` is false because the dialog handles Escape itself), and focus goes
 * back to whatever opened it when it closes.
 */
export function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void, { escape = true }: { escape?: boolean } = {}) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const box = ref.current;
    if (!box) return;
    // The first control inside (or the dialog itself), unless something inside already has focus.
    if (!box.contains(document.activeElement)) {
      const first = box.querySelector<HTMLElement>("[autofocus]") ?? box.querySelector<HTMLElement>(FOCUSABLE);
      if (first) first.focus({ preventScroll: true });
      else {
        box.tabIndex = -1;
        box.focus({ preventScroll: true });
      }
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escape) {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      // Back to what opened it, if it's still on the page.
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [ref, escape]);
}
