"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type CurrentUser = { id: string; email: string };

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/", label: "Home", exact: true },
  { href: "/closet", label: "My Closet" },
  { href: "/outfits", label: "AI Stylist" },
  { href: "/outfits/saved", label: "Saved Looks", exact: true },
  { href: "/profile", label: "Profile" },
];

function isActive(pathname: string | null, link: (typeof LINKS)[number]): boolean {
  // "AI Stylist" stays lit on /outfits/[id] (and its try-on page) — matching the real nav's
  // behavior of keeping that tab active while viewing a just-generated outfit — while
  // /outfits/saved has its own exact match so the two tabs never both light up.
  if (link.href === "/outfits") {
    return pathname === "/outfits" || Boolean(pathname?.startsWith("/outfits/") && !pathname.startsWith("/outfits/saved"));
  }
  if (link.exact) return pathname === link.href;
  return pathname === link.href || Boolean(pathname?.startsWith(`${link.href}/`));
}

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "";

  return (
    <header
      className="relative z-20 h-[88px] border-b"
      style={{
        background: "linear-gradient(90deg, #fbfdfe 0%, #edf4f7 47%, #f7f1f2 72%, #f5f1e9 100%)",
        borderColor: "#cbd7dc",
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1440px] items-center justify-between gap-6 px-6 sm:px-8">
        <Link
          href="/"
          className="font-display shrink-0 text-[28px] leading-none tracking-[-0.7px] text-[#202529] whitespace-nowrap sm:text-[32px]"
        >
          Virtual <em className="font-normal">Mirror</em>
        </Link>

        {user && (
          <nav className="hidden h-full items-stretch gap-9 lg:flex">
            {LINKS.map((link) => {
              const active = isActive(pathname, link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center text-[13px] font-semibold transition-colors ${
                    active ? "text-[#202529]" : "text-[#797f82] hover:text-[#202529]"
                  }`}
                >
                  {link.label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-[2px]"
                      style={{ background: "linear-gradient(90deg, #667985, #f8fcfe, #d8c7ce, #e8ddc9)" }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex min-w-0 shrink-0 items-center gap-3">
          {user === undefined ? null : user ? (
            <>
              <Link
                href="/profile"
                aria-label="Open profile"
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold text-[#323b41] sm:flex"
                style={{
                  borderColor: "#bdcbd1",
                  background: "linear-gradient(145deg, #fff 0%, #b9c7ce 42%, #f8fbfc 62%, #d8c7ce 100%)",
                }}
              >
                {initials}
              </Link>
              <button
                onClick={handleLogout}
                className="hidden h-9 shrink-0 rounded-[5px] border px-3 text-[10px] font-bold text-[#3b4850] sm:flex sm:items-center"
                style={{
                  borderColor: "#c9d5da",
                  background: "linear-gradient(135deg, #fff, #e3ebef 65%, #eee2e5)",
                  boxShadow: "inset 0 1px #fff",
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="shrink-0 rounded-[5px] border px-3 py-2 text-[10px] font-bold text-[#3b4850]"
              style={{
                borderColor: "#c9d5da",
                background: "linear-gradient(135deg, #fff, #e3ebef 65%, #eee2e5)",
              }}
            >
              Log in
            </Link>
          )}

          {user && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-[#323b41] lg:hidden"
            >
              <span className="sr-only">Menu</span>
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
                <path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {user && menuOpen && (
        <div
          className="absolute inset-x-0 top-[88px] flex flex-col border-b px-6 py-3 shadow-[0_15px_30px_rgba(0,0,0,0.06)] lg:hidden"
          style={{ background: "#f6f7f7f5", borderColor: "#dfe3e5" }}
        >
          {LINKS.map((link) => {
            const active = isActive(pathname, link);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`px-1 py-3 text-sm font-semibold ${active ? "text-[#202529]" : "text-[#797f82]"}`}
              >
                {link.label}
              </Link>
            );
          })}
          {user && (
            <button
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="px-1 py-3 text-left text-sm font-semibold text-[#797f82]"
            >
              Log out
            </button>
          )}
        </div>
      )}
    </header>
  );
}
