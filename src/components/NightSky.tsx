/**
 * Small stars on the night background that slowly fade in and out. Fixed behind the page and shown only when
 * <html data-period="night">; still for people who prefer reduced motion. Positions are fixed (not random per
 * render), so the server and browser draw the same sky.
 */
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    left: r(1) * 100,
    top: r(2) * 100,
    size: r(3) > 0.85 ? 2.5 : r(3) > 0.5 ? 1.8 : 1.2,
    duration: 3.5 + r(4) * 5,
    delay: -r(5) * 8,
  };
});

export function NightSky() {
  return (
    <div aria-hidden className="night-sky pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {STARS.map((star, i) => (
        <span
          key={i}
          className="night-star absolute rounded-full bg-white"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
