"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BookmarkIcon, ClosetIcon, HomeIcon, MirrorIcon, SparkleIcon, UserIcon } from "@/components/Icons";

type Section = "home" | "closet" | "stylist" | "tryon" | "saved" | "profile";

const LINKS: { section: Section; href: string; label: string; short: string; Icon: typeof HomeIcon }[] = [
  { section: "home", href: "/", label: "Home", short: "Home", Icon: HomeIcon },
  { section: "closet", href: "/closet", label: "My Closet", short: "Closet", Icon: ClosetIcon },
  { section: "stylist", href: "/outfits", label: "AI Stylist", short: "Stylist", Icon: SparkleIcon },
  { section: "tryon", href: "/try-on", label: "Try On", short: "Try On", Icon: MirrorIcon },
  { section: "saved", href: "/outfits/saved", label: "Saved Looks", short: "Saved", Icon: BookmarkIcon },
  { section: "profile", href: "/profile", label: "Profile", short: "Profile", Icon: UserIcon },
];

/** Which main section a URL belongs to, so exactly one tab is lit everywhere in the app. */
function sectionFor(pathname: string | null): Section | null {
  const p = pathname ?? "/";
  if (p === "/") return "home";
  if (p.startsWith("/closet")) return "closet";
  if (p === "/try-on" || /^\/outfits\/[^/]+\/try-on/.test(p)) return "tryon";
  if (p.startsWith("/outfits/saved")) return "saved";
  if (p.startsWith("/outfits")) return "stylist";
  if (p.startsWith("/profile")) return "profile";
  return null;
}

function Wordmark() {
  return (
    <Link href="/" className="group flex shrink-0 items-baseline gap-3 leading-none" aria-label="Virm home">
      <span className="font-display text-[34px] tracking-[-1px] text-[#1c2328] sm:text-[38px]">
        Vir<em className="font-normal">m</em>
      </span>
      <span className="hidden text-[10px] font-semibold uppercase tracking-[2.2px] text-[#7e888e] lg:inline">
        Your virtual mirror
      </span>
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (pathname === "/login") return null;
  const current = sectionFor(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-[#cbd7dc] bg-[#f6f9fa]/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center gap-6 px-5 sm:px-8 md:h-[76px]">
        <Wordmark />

        {user && (
          <nav aria-label="Main" className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {LINKS.map(({ section, href, label, Icon }) => {
              const active = current === section;
              return (
                <Link
                  key={section}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-2 rounded-[5px] px-3 py-2 text-[12.5px] font-semibold transition-colors lg:px-3.5 ${
                    active ? "text-[#1c2328]" : "text-[#66727a] hover:bg-white/70 hover:text-[#1c2328]"
                  }`}
                >
                  <Icon className={`h-[17px] w-[17px] ${active ? "text-[#1c2328]" : "text-[#8b969c]"}`} />
                  {label}
                  {active && <span aria-hidden className="absolute inset-x-3 -bottom-[17px] h-[2px] bg-[#1c2328]" />}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {user ? (
            <button
              onClick={logout}
              className="rounded-[5px] border border-[#cbd7dc] bg-white/70 px-3 py-2 text-[11px] font-semibold text-[#3b4850] hover:bg-white"
            >
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-[5px] border border-[#cbd7dc] bg-white/70 px-3.5 py-2 text-[11px] font-semibold text-[#3b4850] hover:bg-white"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
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
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#cbd7dc] bg-[#f8fafb]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="grid grid-cols-6">
          {LINKS.map(({ section, href, short, Icon }) => {
            const active = current === section;
            return (
              <li key={section}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${
                    active ? "text-[#1c2328]" : "text-[#7b878d]"
                  }`}
                >
                  <span
                    className={`flex h-7 w-11 items-center justify-center rounded-full ${active ? "bg-[#1c2328] text-white" : ""}`}
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
