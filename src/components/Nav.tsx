"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BagIcon, BookmarkIcon, CalendarIcon, ClosetIcon, CompassIcon, MirrorIcon, PaletteIcon, PlusIcon, SparkleIcon, UserIcon } from "@/components/Icons";
import { PricingSheet } from "@/components/Pricing";
import { CreateMenu } from "@/components/CreateMenu";
import { useBillingStatus } from "@/lib/useBillingStatus";

type Section = "mystyle" | "discover" | "create" | "shop" | "closet" | "studio" | "stylist" | "planner" | "saved" | "profile";
type NavLink = { section: Section; href: string; label: string; short: string; Icon: typeof CompassIcon };

const STUDIO: NavLink = { section: "studio", href: "/studio", label: "Studio", short: "Studio", Icon: MirrorIcon };
const DISCOVER: NavLink = { section: "discover", href: "/discover", label: "Discover", short: "Discover", Icon: CompassIcon };
const MY_STYLE: NavLink = { section: "mystyle", href: "/", label: "My Style", short: "My Style", Icon: SparkleIcon };
const PLANNER: NavLink = { section: "planner", href: "/planner", label: "Planner", short: "Planner", Icon: CalendarIcon };
/** Computers: the main places in the top bar (posting is the Create button beside them). */
const PRIMARY: NavLink[] = [STUDIO, DISCOVER, MY_STYLE, PLANNER];
/** Phones: the bottom bar, with posting (＋) in the middle. Profile is the person's photo at the top right. */
const PHONE_TABS: (NavLink | "create")[] = [STUDIO, DISCOVER, "create", MY_STYLE];
/** Phones: places in the menu under the person's photo (the bottom bar has the main four). */
const PHONE_MORE: NavLink[] = [
  PLANNER,
  // Until My Closet moves into Studio.
  { section: "closet", href: "/closet", label: "My Closet", short: "Closet", Icon: ClosetIcon },
];
/** Everything else: in More on computers, and in the menu under the person's photo on phones. */
const SECONDARY: NavLink[] = [
  // Until My Closet moves into Studio.
  { section: "closet", href: "/closet", label: "My Closet", short: "Closet", Icon: ClosetIcon },
  { section: "shop", href: "/shop", label: "Shopping", short: "Shop", Icon: BagIcon },
  { section: "stylist", href: "/stylist", label: "AI Stylist", short: "Stylist", Icon: PaletteIcon },
  { section: "saved", href: "/outfits/saved", label: "Saved Looks", short: "Saved", Icon: BookmarkIcon },
];

/** Which main section a URL belongs to, so exactly one tab is lit everywhere in the app. */
function sectionFor(pathname: string | null): Section | null {
  const p = pathname ?? "/";
  // My Style is the first page; Discover is the feed, posts and public profiles. Posting lights the ＋.
  if (p === "/") return "mystyle";
  if (p.startsWith("/discover") || p.startsWith("/feed") || p.startsWith("/p/") || p.startsWith("/u/")) return "discover";
  if (p.startsWith("/create")) return "create";
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
    <Link href="/" className="group flex shrink-0 items-baseline gap-3 leading-none" aria-label="Virm: My Style">
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
 * The person's profile photo (or initial) on the right: Profile, Admin for admins, and Log out. On phones it also holds
 * Planner, Shopping, AI Stylist and Saved Looks (the bottom bar has the four main places).
 */
/** Sent by the profile editor when the profile photo changes (detail: its new address, or null when removed). */
export const PROFILE_PHOTO_EVENT = "virm-profile-photo";

/** The person's own profile photo (the one on their public profile), kept in step when it's changed. */
function useProfilePhoto(signedIn: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let gone = false;
    fetch("/api/me/public-profile", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { avatarUrl: string | null }).avatarUrl : null))
      .then((u) => !gone && setUrl(u))
      .catch(() => {});
    const changed = (e: Event) => setUrl((e as CustomEvent<string | null>).detail);
    window.addEventListener(PROFILE_PHOTO_EVENT, changed);
    return () => {
      gone = true;
      window.removeEventListener(PROFILE_PHOTO_EVENT, changed);
    };
  }, [signedIn]);
  return signedIn ? url : null;
}

function AccountMenu({ current }: { current: Section | null }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen, button, panel, panelId] = useMenu();
  // The profile photo, not the Studio try-on photo (a new Studio photo never changes it).
  const photo = useProfilePhoto(Boolean(user));
  if (!user) return null;
  const initial = (user.displayName?.trim() || user.email).charAt(0).toUpperCase();
  // Lit on Profile and Admin; on phones also on the pages in this menu (computers light More for those).
  const lit = current === "profile" || Boolean(pathname?.startsWith("/admin"));
  const litOnPhones = [...PHONE_MORE, ...SECONDARY].some((l) => l.section === current);
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
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- the person's own profile photo
          <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
      </button>
      {open && (
        <div ref={panel} id={panelId} className={menuPanel}>
          <ul>
            {/* Phones: the pages that aren't in the bottom bar. */}
            {[...PHONE_MORE, ...SECONDARY.filter((l) => !PHONE_MORE.some((m) => m.section === l.section))].map(({ section, href, label, Icon }) => (
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
  const [creating, setCreating] = useState(false);
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
          {/* Computers: posting, one tap from anywhere. */}
          {user && (
            <button
              onClick={() => setCreating(true)}
              aria-haspopup="dialog"
              className={`hidden min-h-[40px] items-center gap-1.5 rounded-full px-4 text-[12.5px] font-semibold md:flex ${
                current === "create"
                  ? "bg-[#121821] text-white"
                  : "bg-white text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)]"
              }`}
            >
              <PlusIcon className="h-4 w-4" />
              Create
            </button>
          )}
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
      {creating && <CreateMenu onClose={() => setCreating(false)} />}
    </header>
  );
}

/** Phone navigation: Studio, Discover, ＋ (post) and My Style, always one tap away at the bottom. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
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
          {PHONE_TABS.map((tab) => {
            if (tab === "create") {
              return (
                <li key="create" className="flex items-center justify-center">
                  <button
                    onClick={() => setCreating(true)}
                    aria-label="Create a post"
                    aria-haspopup="dialog"
                    className="flex h-11 w-14 items-center justify-center rounded-[16px] bg-[#121821] text-white shadow-[0_6px_16px_rgba(18,24,33,0.25)] transition-transform active:scale-95"
                  >
                    <PlusIcon className="h-[22px] w-[22px]" />
                  </button>
                </li>
              );
            }
            const { section, href, short, Icon } = tab;
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
      {creating && <CreateMenu onClose={() => setCreating(false)} />}
    </>
  );
}
