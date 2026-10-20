/**
 * Glitter on the night background: tiny, small and medium stars that twinkle, plus a few bigger ones that now and
 * then flash with a four-point shine. Every star has its own timing, so they never sync. Fixed behind the page and
 * shown only when <html data-period="night">; still for people who prefer reduced motion. Positions are fixed (not
 * random per render), so the server and browser draw the same sky.
 */
const STARS = Array.from({ length: 80 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const shine = r(7) > 0.84;
  return {
    left: r(1) * 100,
    top: r(2) * 100,
    shine,
    size: shine ? 10 + r(3) * 9 : r(3) > 0.8 ? 2.6 : r(3) > 0.45 ? 1.8 : 1.1,
    glow: 0.3 + r(6) * 0.5,
    duration: shine ? 6 + r(4) * 10 : 3 + r(4) * 6,
    delay: -r(5) * 16,
  };
});

export function NightSky() {
  return (
    <div aria-hidden className="night-sky pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {STARS.map((star, i) => (
        <span
          key={i}
          className={star.shine ? "night-shine absolute" : "night-star absolute rounded-full bg-white"}
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
            ["--glow" as string]: star.glow,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
