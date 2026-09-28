import Link from "next/link";

export function Nav() {
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
      </nav>
    </header>
  );
}
