"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BagIcon, BookmarkIcon, CalendarIcon, ClosetIcon, HomeIcon, MirrorIcon, PaletteIcon, UserIcon } from "@/components/Icons";
import { MirrorImage } from "@/components/SavedPhoto";
import { PricingSheet } from "@/components/Pricing";
import { useBillingStatus } from "@/lib/useBillingStatus";

type Section = "home" | "shop" | "closet" | "studio" | "stylist" | "planner" | "saved" | "profile";
type NavLink = { section: Section; href: string; label: string; short: string; Icon: typeof HomeIcon };

/** The four main places: in the top bar on computers, and the bottom bar on phones. */
const PRIMARY: NavLink[] = [
  { section: "home", href: "/", label: "Home", short: "Home", Icon: HomeIcon },
  { section: "closet", href: "/closet", label: "My Closet", short: "Closet", Icon: ClosetIcon },
  { section: "studio", href: "/studio", label: "Studio", short: "Studio", Icon: MirrorIcon },
  { section: "planner", href: "/planner", label: "Planner", short: "Planner", Icon: CalendarIcon },
];
/** Everything else: in More on computers, and in the menu under the person's photo on phones. */
const SECONDARY: NavLink[] = [
  { section: "shop", href: "/shop", label: "Shopping", short: "Shop", Icon: BagIcon },
  { section: "stylist", href: "/stylist", label: "AI Stylist", short: "Stylist", Icon: PaletteIcon },
  { section: "saved", href: "/outfits/saved", label: "Saved Looks", short: "Saved", Icon: BookmarkIcon },
];

/** Which main section a URL belongs to, so exactly one tab is lit everywhere in the app. */
function sectionFor(pathname: string | null): Section | null {
  const p = pathname ?? "/";
  if (p === "/") return "home";
  if (p.startsWith("/shop")) return "shop";
  if (p.startsWith("/closet")) return "closet";
  if (p.startsWith("/stylist")) return "stylist";
  if (p.startsWith("/outfits/saved")) return "saved";
  if (p.startsWith("/planner")) return "planner";
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

/**
 * A small menu that opens under its button: Enter or Space opens it, Escape closes it and returns to the button, a
 * tap outside or choosing a page closes it.
 */
function useMenu() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const id = useId();
  // A new page closes it.
  const [shownOn, setShownOn] = useState(pathname);
  if (shownOn !== pathname) {
    setShownOn(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return [open, setOpen, button, panel, id] as const;
}

const menuPanel =
  "absolute right-0 top-[calc(100%+8px)] z-40 min-w-[220px] overflow-hidden rounded-[18px] bg-white p-1.5 shadow-[0_24px_60px_rgba(18,30,45,0.18)] ring-1 ring-black/[0.06]";
const menuItem = (active: boolean) =>
  `flex min-h-[44px] items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium ${active ? "bg-[#f1efeb] text-[#121821]" : "text-[#29343a] hover:bg-[#f6f5f2]"}`;

/** Computers: Shopping, AI Stylist and Saved Looks. Lit when one of them is open. */
function MoreMenu({ current }: { current: Section | null }) {
  const [open, setOpen, button, panel, panelId] = useMenu();
  const inside = SECONDARY.some((l) => l.section === current);
  return (
    <div className="relative">
      <button
        ref={button}
        data-tip="more"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ${
          inside ? "bg-white text-[#121821] shadow-[0_1px_2px_rgba(18,24,33,0.08)]" : "text-[#4f5b66] hover:text-[#121821]"
        }`}
      >
        More
        <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div ref={panel} id={panelId} className={menuPanel}>
          <ul>
            {SECONDARY.map(({ section, href, label, Icon }) => (
              <li key={section}>
                <Link href={href} aria-current={current === section ? "page" : undefined} onClick={() => setOpen(false)} className={menuItem(current === section)}>
                  <Icon className="h-[18px] w-[18px] text-[#4f5b66]" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The person's photo (or initial) on the right: Profile, Admin for admins, and Log out. On phones it also holds
 * Shopping, AI Stylist and Saved Looks (the bottom bar has the four main places).
 */
function AccountMenu({ current }: { current: Section | null }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen, button, panel, panelId] = useMenu();
  if (!user) return null;
  const initial = (user.displayName?.trim() || user.email).charAt(0).toUpperCase();
  // Lit on Profile and Admin; on phones also on the pages in this menu (computers light More for those).
  const lit = current === "profile" || Boolean(pathname?.startsWith("/admin"));
  const litOnPhones = SECONDARY.some((l) => l.section === current);
  return (
    <div className="relative">
      <button
        ref={button}
        data-tip="account"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#e9e6e0] font-display text-[17px] text-[#121821] ring-offset-2 ${
          lit || open ? "ring-2 ring-[#121821]" : litOnPhones ? "ring-1 ring-black/10 max-md:ring-2 max-md:ring-[#121821]" : "ring-1 ring-black/10"
        }`}
      >
        <span aria-hidden>{initial}</span>
        {user.photoVersion && <MirrorImage original className="absolute inset-0 h-full w-full object-cover object-top" />}
      </button>
      {open && (
        <div ref={panel} id={panelId} className={menuPanel}>
          <ul>
            {/* Phones: the pages that aren't in the bottom bar. */}
            {SECONDARY.map(({ section, href, label, Icon }) => (
              <li key={section} className="md:hidden">
                <Link href={href} aria-current={current === section ? "page" : undefined} className={menuItem(current === section)}>
                  <Icon className="h-[18px] w-[18px] text-[#4f5b66]" />
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/profile" aria-current={current === "profile" ? "page" : undefined} className={menuItem(current === "profile")}>
                <UserIcon className="h-[18px] w-[18px] text-[#4f5b66]" />
                Profile
              </Link>
            </li>
            {user.isAdmin && (
              <li>
                <Link href="/admin" aria-current={pathname?.startsWith("/admin") ? "page" : undefined} className={menuItem(Boolean(pathname?.startsWith("/admin")))}>
                  <span className="flex h-[18px] w-[18px] items-center justify-center text-[11px] font-bold text-[#4f5b66]" aria-hidden>
                    A
                  </span>
                  Admin
                </Link>
              </li>
            )}
            <li className="mt-1 border-t border-black/[0.06] pt-1">
              <button onClick={logout} className={`${menuItem(false)} w-full text-left`}>
                Log out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const current = sectionFor(pathname);
  useSectionVisit(current, Boolean(user));
  const [plansOpen, setPlansOpen] = useState(false);
  const subscribed = Boolean(useBillingStatus()?.subscribed);

  if (pathname === "/login") return null;

  return (
    <header className="site-nav sticky top-0 z-30 border-b border-black/[0.06] backdrop-blur-xl">
      <div className="mx-auto flex h-[64px] w-full max-w-[1440px] items-center gap-3 px-4 sm:px-8 md:h-[72px] lg:gap-6">
        <Wordmark />

        {user && (
          <nav aria-label="Main" className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
            {PRIMARY.map(({ section, href, label }) => {
              const active = current === section;
              return (
                <Link
                  key={section}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-colors ${
                    active ? "bg-white text-[#121821] shadow-[0_1px_2px_rgba(18,24,33,0.08)]" : "text-[#4f5b66] hover:text-[#121821]"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <MoreMenu current={current} />
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Plans, one tap away on every page; they open over the page instead of leaving it. */}
          {/* Not for Plus members (they manage Plus from Profile). */}
          {user && !subscribed && (
            <button
              onClick={() => setPlansOpen(true)}
              className="nav-upgrade min-h-[40px] rounded-full bg-[#121821] px-4 text-[12.5px] font-semibold text-white hover:bg-[#2a3542]"
            >
              Upgrade
            </button>
          )}
          {user ? (
            <AccountMenu current={current} />
          ) : (
            <Link
              href="/login"
              className="flex min-h-[40px] items-center rounded-full bg-white px-4 text-[12.5px] font-medium text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.12)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.28)]"
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

/** Phone navigation: the four main places, always one tap away at the bottom of the screen. */
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
        <ul className="grid grid-cols-4">
          {PRIMARY.map(({ section, href, short, Icon }) => {
            const active = current === section;
            return (
              <li key={section}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-[#121821]" : "text-[#4f5b66]"}`}
                >
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? "bg-[#121821] text-white" : ""}`}>
                    <Icon className="h-[19px] w-[19px]" />
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
