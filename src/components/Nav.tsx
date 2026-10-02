"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/", label: "Home", exact: true },
  { href: "/closet", label: "My Closet" },
  { href: "/outfits", label: "AI Stylist" },
  { href: "/outfits/saved", label: "Saved Looks", exact: true },
];

function isActive(pathname: string | null, link: (typeof LINKS)[number]): boolean {
  // "AI Stylist" stays lit on /outfits/[id] (and its try-on page) while /outfits/saved has its
  // own exact match, so the two tabs never both light up.
  if (link.href === "/outfits") {
    return pathname === "/outfits" || Boolean(pathname?.startsWith("/outfits/") && !pathname.startsWith("/outfits/saved"));
  }
  if (link.exact) return pathname === link.href;
  return pathname === link.href || Boolean(pathname?.startsWith(`${link.href}/`));
}

const BUTTON_STYLE = {
  borderColor: "#c9d5da",
  background: "linear-gradient(135deg, #fff, #e3ebef 65%, #eee2e5)",
  boxShadow: "inset 0 1px #fff",
};

export function Nav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (pathname === "/login") return null;

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "";

  return (
    <header
      className="relative z-20 border-b"
      style={{
        background: "linear-gradient(90deg, #fbfdfe 0%, #edf4f7 47%, #f7f1f2 72%, #f5f1e9 100%)",
        borderColor: "#cbd7dc",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4 sm:px-8 md:h-[88px] md:py-0">
        <Link
          href="/"
          className="font-display shrink-0 text-[28px] leading-none tracking-[-0.7px] text-[#202529] whitespace-nowrap sm:text-[32px]"
        >
          Virtual <em className="font-normal">Mirror</em>
        </Link>

        {user && (
          <nav
            aria-label="Main"
            className="order-3 flex w-full items-center gap-1 overflow-x-auto rounded-[7px] border bg-white/60 p-1 md:order-none md:w-auto"
            style={{ borderColor: "#cbd7dc" }}
          >
            {LINKS.map((link) => {
              const active = isActive(pathname, link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`btn-tactile shrink-0 whitespace-nowrap rounded-[5px] px-3.5 py-2 text-[12px] font-semibold ${
                    active
                      ? "bg-[#242b30] text-white shadow-[inset_0_1px_0_#ffffff35]"
                      : "text-[#5d666b] hover:bg-[#e9edef] hover:text-[#202529]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {user ? (
            <>
              <Link
                href="/profile"
                aria-label="Open profile"
                aria-current={pathname === "/profile" ? "page" : undefined}
                className={`btn-tactile flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold text-[#323b41] ${
                  pathname === "/profile" ? "ring-2 ring-[#242b30] ring-offset-2 ring-offset-[#f3f6f7]" : ""
                }`}
                style={{
                  borderColor: "#bdcbd1",
                  background: "linear-gradient(145deg, #fff 0%, #b9c7ce 42%, #f8fbfc 62%, #d8c7ce 100%)",
                }}
              >
                {initials}
              </Link>
              <button
                onClick={logout}
                className="flex h-9 shrink-0 items-center rounded-[5px] border px-3 text-[10px] font-bold text-[#3b4850]"
                style={BUTTON_STYLE}
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="shrink-0 rounded-[5px] border px-3 py-2 text-[10px] font-bold text-[#3b4850]"
              style={BUTTON_STYLE}
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
