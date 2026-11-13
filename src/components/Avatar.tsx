"use client";

/** A round profile picture, or the first letter on a soft circle when there's none. */
export function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a small public picture
    <img src={url} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full bg-[#e7e3dc] font-display text-[#5d6874]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
