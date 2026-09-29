"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CurrentUser = { id: string; email: string };

export function Nav() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);

  useEffect(() => {
    let ignore = false;
    fetch("/api/auth/me")
      .then((res) => res.json() as Promise<{ user: CurrentUser | null }>)
      .then((data) => {
        if (!ignore) setUser(data.user);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
        <Link href="/" className="shrink-0 font-semibold tracking-tight">
          Virtual Mirror
        </Link>
        <Link href="/closet" className="shrink-0 text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
          Closet
        </Link>
        <Link href="/outfits" className="shrink-0 text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
          Outfits
        </Link>
        <div className="ml-auto min-w-0 text-sm">
          {user === undefined ? null : user ? (
            <div className="flex min-w-0 items-center gap-3">
              <span className="min-w-0 max-w-[50vw] truncate text-zinc-500 sm:max-w-xs" title={user.email}>
                {user.email}
              </span>
              <button onClick={handleLogout} className="shrink-0 text-zinc-600 hover:underline dark:text-zinc-400">
                Log out
              </button>
            </div>
          ) : (
            <Link href="/login" className="text-zinc-600 hover:underline dark:text-zinc-400">
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
