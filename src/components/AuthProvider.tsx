"use client";

import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useToast } from "@/components/Toast";
import { afterMinDelay } from "@/lib/minDelay";

export type CurrentUser = { id: string; email: string };
type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  user: CurrentUser | null;
  /** Call after the login/signup API succeeds: shows the branded loading screen once, then enters the app. */
  completeLogin: (message: string) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

const PUBLIC_PATHS = ["/", "/login"];

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: CurrentUser | null };
    return data.user;
  } catch {
    return null;
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

  useEffect(() => {
    let ignore = false;
    fetchCurrentUser().then((u) => {
      if (ignore) return;
      setUser(u);
      setStatus(u ? "signedIn" : "signedOut");
    });
    return () => {
      ignore = true;
    };
  }, []);

  const completeLogin = useCallback(
    (message: string) => {
      const startedAt = Date.now();
      setStatus("loading");
      router.replace("/");
      fetchCurrentUser().then((u) => {
        afterMinDelay(startedAt, 1400, () => {
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

  const isPublicPath = PUBLIC_PATHS.includes(pathname ?? "/");

  // Signed-out visits to a protected URL go to login; an explicit logout goes to the public intro instead.
  useEffect(() => {
    if (status === "signedOut" && !isPublicPath) router.replace(justLoggedOut.current ? "/" : "/login");
    if (status === "signedIn") {
      justLoggedOut.current = false;
      if (pathname === "/login") router.replace("/");
    }
  }, [status, isPublicPath, pathname, router]);

  const value = useMemo(() => ({ status, user, completeLogin, logout }), [status, user, completeLogin, logout]);

  return (
    <AuthContext.Provider value={value}>
      {status === "loading" ? (
        <LoadingScreen />
      ) : status === "signedOut" && !isPublicPath ? null : (
        <Fragment key={sessionKey}>{children}</Fragment>
      )}
    </AuthContext.Provider>
  );
}
