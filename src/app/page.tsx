import Link from "next/link";
import Image from "next/image";

const STEPS = [
  {
    title: "Upload your clothes",
    body: "Snap photos of what's already in your closet — no need to shop for anything new.",
  },
  {
    title: "AI catalogs everything",
    body: "Nav identifies the category, color, material, and season of each piece automatically.",
  },
  {
    title: "Get outfit picks",
    body: "Tell Nav what you're dressing for, and get outfits built entirely from what you own.",
  },
];

const TEASER_ITEMS = [
  { src: "/sample/white-shirt.svg", label: "White fitted shirt" },
  { src: "/sample/blue-jeans.svg", label: "Straight-leg jeans" },
  { src: "/sample/gray-cardigan.svg", label: "Gray cardigan" },
  { src: "/sample/white-sneakers.svg", label: "White sneakers" },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto flex w-full max-w-4xl flex-col items-start gap-6 px-6 py-24 sm:py-32">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          AI personal styling
        </p>
        <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Your closet. Your style. Your AI stylist.
        </h1>
        <p className="max-w-lg text-lg text-zinc-600 dark:text-zinc-400">
          Turn the clothes you already own into personalized outfits — and see how they look
          together.
        </p>
        <div className="mt-2 flex flex-wrap gap-4">
          <Link
            href="/closet"
            className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Build My Closet
          </Link>
          <Link
            href="#how-it-works"
            className="rounded-full border border-black/15 px-6 py-3 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            See How It Works
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-black/10 dark:border-white/10">
        <div className="mx-auto w-full max-w-4xl px-6 py-20">
          <h2 className="mb-10 text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  Step {i + 1}
                </p>
                <h3 className="mb-2 text-base font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 dark:border-white/10">
        <div className="mx-auto w-full max-w-4xl px-6 py-20">
          <h2 className="mb-2 text-2xl font-semibold tracking-tight">Start exploring instantly</h2>
          <p className="mb-8 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Every new account comes with a small sample closet, so there&apos;s something to work with
            before you upload a single photo.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {TEASER_ITEMS.map((item) => (
              <div
                key={item.src}
                className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950"
              >
                <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-900">
                  <Image src={item.src} alt={item.label} fill className="object-cover" unoptimized />
                </div>
                <p className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
