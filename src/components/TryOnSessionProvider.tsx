"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/** How long a confirmed photo is kept without any Try It On activity before it is discarded. */
const IDLE_MS = 30 * 60 * 1000;

type SessionPhoto = { blob: Blob; url: string };

type TryOnSession = {
  photo: SessionPhoto | null;
  /** Keep this photo for the rest of the Try It On session. */
  setPhoto: (blob: Blob) => void;
  /** Throw the photo away now. */
  clearPhoto: () => void;
  /** Mark the session as in use, restarting the idle timer. */
  touch: () => void;
};

const TryOnSessionContext = createContext<TryOnSession | null>(null);

export function useTryOnSession(): TryOnSession {
  const ctx = useContext(TryOnSessionContext);
  if (!ctx) throw new Error("useTryOnSession must be used inside <TryOnSessionProvider>");
  return ctx;
}

/**
 * A temporary, in-memory home for the person's confirmed Try It On photo, so they can move between outfits
 * (Outfit Detail, Saved Looks, AI Stylist) without re-taking it. It is never written to storage, the account,
 * or the server. It lives only in this browser tab and is discarded when the person logs out (this provider
 * sits inside the auth boundary, which remounts on logout), reloads or closes the tab, chooses a different
 * photo, or leaves Try It On idle for 30 minutes.
 */
export function TryOnSessionProvider({ children }: { children: React.ReactNode }) {
  const [photo, setPhotoState] = useState<SessionPhoto | null>(null);
  const [lastUsed, setLastUsed] = useState(0);
  const photoRef = useRef<SessionPhoto | null>(null);
  const lastUsedRef = useRef(0);

  const release = useCallback(() => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
    photoRef.current = null;
    setPhotoState(null);
  }, []);

  const setPhoto = useCallback(
    (blob: Blob) => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
      const next = { blob, url: URL.createObjectURL(blob) };
      photoRef.current = next;
      lastUsedRef.current = Date.now();
      setPhotoState(next);
      setLastUsed(lastUsedRef.current);
    },
    []
  );

  const touch = useCallback(() => {
    if (!photoRef.current) return;
    lastUsedRef.current = Date.now();
    setLastUsed(lastUsedRef.current);
  }, []);

  // Discard after IDLE_MS of inactivity.
  useEffect(() => {
    if (!photo) return;
    const timer = setTimeout(release, IDLE_MS);
    return () => clearTimeout(timer);
  }, [photo, lastUsed, release]);

  // Timers are paused while a phone tab is in the background, so also check the clock when it comes back.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && photoRef.current && Date.now() - lastUsedRef.current > IDLE_MS) {
        release();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [release]);

  // Free the object URL if the whole provider goes away (logout / user switch).
  useEffect(
    () => () => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
    },
    []
  );

  const value = useMemo(() => ({ photo, setPhoto, clearPhoto: release, touch }), [photo, setPhoto, release, touch]);

  return <TryOnSessionContext.Provider value={value}>{children}</TryOnSessionContext.Provider>;
}
