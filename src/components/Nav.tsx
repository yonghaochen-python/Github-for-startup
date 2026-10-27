"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BagIcon, BookmarkIcon, ClosetIcon, HomeIcon, SparkleIcon, UserIcon } from "@/components/Icons";
import { PricingSheet } from "@/components/Pricing";

type Section = "home" | "shop" | "closet" | "studio" | "saved" | "profile";

const LINKS: { section: Section; href: string; label: string; short: string; Icon: typeof HomeIcon }[] = [
  { section: "home", href: "/", label: "Home", short: "Home", Icon: HomeIcon },
  { section: "shop", href: "/shop", label: "Shopping", short: "Shop", Icon: BagIcon },
  { section: "closet", href: "/closet", label: "My Closet", short: "Closet", Icon: ClosetIcon },
  { section: "studio", href: "/studio", label: "Studio", short: "Studio", Icon: SparkleIcon },
  { section: "saved", href: "/outfits/saved", label: "Saved Looks", short: "Saved", Icon: BookmarkIcon },
  { section: "profile", href: "/profile", label: "Profile", short: "Profile", Icon: UserIcon },
];

/** Which main section a URL belongs to, so exactly one tab is lit everywhere in the app. */
function sectionFor(pathname: string | null): Section | null {
  const p = pathname ?? "/";
  if (p === "/") return "home";
  if (p.startsWith("/shop")) return "shop";
  if (p.startsWith("/closet")) return "closet";
  if (p.startsWith("/outfits/saved")) return "saved";
  if (p.startsWith("/studio") || p.startsWith("/outfits") || p === "/try-on") return "studio";
  if (p.startsWith("/profile")) return "profile";
  return null;
}

function Wordmark() {
  return (
    <Link href="/" className="group flex shrink-0 items-baseline gap-3 leading-none" aria-label="Virm home">
      <span className="font-display text-[34px] tracking-[-1px] text-[#121821] sm:text-[36px]">
        Vir<em className="font-normal">m</em>
      </span>
      <span className="hidden text-[10px] font-semibold uppercase tracking-[2.2px] text-[#4f5b66] 2xl:inline">
        Your virtual mirror
      </span>
    </Link>
  );
}

/** Tells the server which main section a signed-in person opened (section name only; deduplicated hourly there). */
function useSectionVisit(section: Section | null, signedIn: boolean) {
  useEffect(() => {
    if (!signedIn || !section) return;
    fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section }),
      keepalive: true,
    }).catch(() => {});
  }, [section, signedIn]);
}

export function Nav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const current = sectionFor(pathname);
  useSectionVisit(current, Boolean(user));
  const [plansOpen, setPlansOpen] = useState(false);

  if (pathname === "/login") return null;

  return (
    <header className="site-nav sticky top-0 z-30 border-b border-black/[0.06] backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center gap-3 px-5 lg:gap-6 sm:px-8 md:h-[76px]">
        <Wordmark />

        {user && (
          <nav aria-label="Main" className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex lg:gap-1">
            {LINKS.map(({ section, href, label, Icon }) => {
              const active = current === section;
              return (
                <Link
                  key={section}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 py-2 text-[12.5px] lg:px-3.5 lg:text-[13px] font-medium transition-colors ${
                    active ? "bg-white text-[#121821] shadow-[0_1px_2px_rgba(18,24,33,0.08)]" : "text-[#5b6875] hover:text-[#121821]"
                  }`}
                >
                  <Icon className={`hidden h-[17px] w-[17px] xl:block ${active ? "text-[#121821]" : "text-[#5d6874]"}`} />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Plans, one tap away on every page; they open over the page instead of leaving it. */}
          {user && (
            <button
              onClick={() => setPlansOpen(true)}
              className="nav-upgrade rounded-full bg-[#121821] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#2a3542]"
            >
              Upgrade
            </button>
          )}
          {user?.isAdmin && (
            <Link
              href="/admin"
              aria-current={pathname?.startsWith("/admin") ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-[12px] font-medium ${
                pathname?.startsWith("/admin")
                  ? "bg-[#121821] text-white"
                  : "bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.28)]"
              }`}
            >
              Admin
            </Link>
          )}
          {user ? (
            <button
              onClick={logout}
              className="rounded-full bg-white px-4 py-2 text-[12px] font-medium text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.28)]"
            >
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-white px-4 py-2 text-[12px] font-medium text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.28)]"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
      {plansOpen && <PricingSheet onClose={() => setPlansOpen(false)} />}
    </header>
  );
}

/** Phone navigation: the six main tools, always one tap away at the bottom of the screen. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user || pathname === "/login") return null;
  const current = sectionFor(pathname);

  return (
    <>
      <div aria-hidden className="h-[calc(64px+env(safe-area-inset-bottom))] md:hidden" />
      <nav
        aria-label="Main"
        className="site-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.06] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${LINKS.length}, minmax(0, 1fr))` }}>
          {LINKS.map(({ section, href, short, Icon }) => {
            const active = current === section;
            return (
              <li key={section}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${
                    active ? "text-[#121821]" : "text-[#5d6874]"
                  }`}
                >
                  <span
                    className={`flex h-7 w-10 items-center justify-center rounded-full ${active ? "bg-[#121821] text-white" : ""}`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
