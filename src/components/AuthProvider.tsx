"use client";

import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useToast } from "@/components/Toast";
import { afterMinDelay } from "@/lib/minDelay";
import { fetchWithRetry } from "@/lib/fetchRetry";

/**
 * photoVersion is set when the person has a saved try-on photo (it changes whenever the photo is replaced).
 * look is their current look: the latest try-on result, shown on their photo until they change it.
 */
export type CurrentUser = {
  id: string;
  /** The login. Shown read-only; it can't be changed in the app. */
  email: string;
  /** The name shown in the app, if the person set one. */
  displayName?: string | null;
  photoVersion: string | null;
  look: { version: string; outfitId: string } | null;
  /** Only shows/hides the Admin link; every admin page and request is checked again on the server. */
  isAdmin?: boolean;
};
type AuthStatus = "loading" | "signedOut" | "signedIn" | "unavailable";

type AuthContextValue = {
  status: AuthStatus;
  user: CurrentUser | null;
  /** Call after the login/signup API succeeds: shows the branded loading screen once, then enters the app. */
  completeLogin: (message: string) => void;
  logout: () => Promise<void>;
  /** Re-reads the signed-in user (e.g. after saving or removing the try-on photo) without the loading screen. */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

const PUBLIC_PATHS = ["/", "/login", "/reset-password", "/about", "/how-it-works", "/pricing", "/privacy", "/terms", "/contact", "/try", "/join"];

/**
 * Who's signed in. A connection problem or server hiccup is tried again; if Virm still can't be reached the answer
 * is "unavailable" (never "signed out"), so a short outage doesn't send anyone to the login page.
 */
async function fetchCurrentUser(): Promise<CurrentUser | null | "unavailable"> {
  try {
    const res = await fetchWithRetry("/api/auth/me", { cache: "no-store" });
    if (res.status >= 500) return "unavailable";
    if (!res.ok) return null;
    const data = (await res.json()) as { user: CurrentUser | null };
    return data.user;
  } catch {
    return "unavailable";
  }
}

/**
 * The single source of truth for "who is using the app":
 *   loading   -> branded loading screen (only while auth is being resolved: first load, or right after login)
 *   signedOut -> public intro / login only
 *   signedIn  -> the app
 * Everything below is remounted (keyed) whenever the session changes, so no page can keep
 * showing a previous user's closet, outfits, or profile after logout or a user switch.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const justLoggedOut = useRef(false);

  const [checkCount, setCheckCount] = useState(0);
  useEffect(() => {
    let ignore = false;
    fetchCurrentUser().then((u) => {
      if (ignore) return;
      if (u === "unavailable") return setStatus("unavailable");
      setUser(u);
      setStatus(u ? "signedIn" : "signedOut");
    });
    return () => {
      ignore = true;
    };
  }, [checkCount]);

  // Can't reach Virm: check again by itself when the connection comes back, or after a few seconds.
  useEffect(() => {
    if (status !== "unavailable") return;
    const retry = () => setCheckCount((n) => n + 1);
    window.addEventListener("online", retry);
    const timer = setTimeout(retry, 10_000);
    return () => {
      window.removeEventListener("online", retry);
      clearTimeout(timer);
    };
  }, [status]);

  const completeLogin = useCallback(
    (message: string) => {
      const startedAt = Date.now();
      setStatus("loading");
      router.replace("/");
      fetchCurrentUser().then((u) => {
        afterMinDelay(startedAt, 1400, () => {
          if (u === "unavailable") return setStatus("unavailable");
          setUser(u);
          setSessionKey((k) => k + 1);
          setStatus(u ? "signedIn" : "signedOut");
          if (u) showToast(message);
        });
      });
    },
    [router, showToast]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      justLoggedOut.current = true;
      setUser(null);
      setStatus("signedOut");
      setSessionKey((k) => k + 1);
      router.replace("/");
    }
  }, [router]);

  const refreshUser = useCallback(async () => {
    const u = await fetchCurrentUser();
    if (u && u !== "unavailable") setUser(u);
  }, []);

  // A shared "Share looks" link opens for anyone who has it.
  const isPublicPath = PUBLIC_PATHS.includes(pathname ?? "/") || (pathname ?? "").startsWith("/pick/");

  // Signed-out visits to a protected URL go to login; an explicit logout goes to the public intro instead.
  useEffect(() => {
    if (status === "signedOut" && !isPublicPath) router.replace(justLoggedOut.current ? "/" : "/login");
    if (status === "signedIn") {
      justLoggedOut.current = false;
      if (pathname === "/login") router.replace("/");
    }
  }, [status, isPublicPath, pathname, router]);

  const value = useMemo(
    () => ({ status, user, completeLogin, logout, refreshUser }),
    [status, user, completeLogin, logout, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {status === "loading" ? (
        <LoadingScreen />
      ) : status === "unavailable" ? (
        <div role="alert" className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-display text-[32px] leading-tight text-[#121821]">Can&apos;t reach Virm right now</p>
          <p className="max-w-sm text-[14px] text-[#4f5b66]">Check your connection. This page tries again by itself.</p>
          <button
            onClick={() => setCheckCount((n) => n + 1)}
            className="rounded-full bg-[#121821] px-6 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#2a3542]"
          >
            Try again
          </button>
        </div>
      ) : status === "signedOut" && !isPublicPath ? null : (
        <Fragment key={sessionKey}>{children}</Fragment>
      )}
    </AuthContext.Provider>
  );
}
