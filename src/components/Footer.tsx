import Link from "next/link";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

/** On every page: the trust links and the "private by design" promise. */
export function Footer() {
  return (
    <footer className="site-footer border-t border-black/[0.06]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-5 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <p className="whitespace-nowrap text-[13px] font-semibold text-[#26313a]">
          Private by design <span className="font-normal text-[#4f5b66]">· Your closet stays yours.</span>
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap text-[13px] text-[#4f5b66] underline-offset-4 hover:text-[#121821] hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="whitespace-nowrap text-[12px] text-[#5d6874]">© 2026 Virm</p>
      </div>
    </footer>
  );
}
