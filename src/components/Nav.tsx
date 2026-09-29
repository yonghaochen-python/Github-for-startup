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
      <nav className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          Virtual Mirror
        </Link>
        <Link href="/closet" className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
          Closet
        </Link>
        <Link href="/outfits" className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
          Outfits
        </Link>
        <div className="ml-auto text-sm">
          {user === undefined ? null : user ? (
            <div className="flex items-center gap-3">
              <span className="text-zinc-500">{user.email}</span>
              <button onClick={handleLogout} className="text-zinc-600 hover:underline dark:text-zinc-400">
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
