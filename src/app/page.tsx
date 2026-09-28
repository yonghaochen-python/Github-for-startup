import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Virtual Mirror</h1>
      <p className="max-w-lg text-lg text-zinc-600 dark:text-zinc-400">
        Upload photos of your clothes, let AI catalog them into a digital closet, and get outfit
        combinations built from what you already own.
      </p>
      <div className="flex gap-4">
        <Link
          href="/closet"
          className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Build your closet
        </Link>
        <Link
          href="/outfits"
          className="rounded-full border border-black/15 px-5 py-3 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          See outfits
        </Link>
      </div>
    </main>
  );
}
