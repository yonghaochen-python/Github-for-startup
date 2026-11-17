"use client";

import { useEffect, useRef, useState } from "react";

const SoundIcon = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="m16 9.5 5 5M21 9.5l-5 5" />}
  </svg>
);

/** Only one feed video makes sound at a time: turning one on turns the others off. */
const SOUND_EVENT = "virm-feed-sound";

/**
 * A video post in the feed: plays (muted, looping) only while most of it is on screen, and pauses when scrolled
 * away, so nothing plays unseen. The cover shows until it starts. The small speaker turns sound on or off.
 */
export function FeedVideo({ src, poster, className, alt }: { src: string; poster: string; className?: string; alt: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: [0, 0.6, 1] }
    );
    watcher.observe(video);
    const others = (e: Event) => {
      if ((e as CustomEvent<HTMLVideoElement>).detail !== video) setSound(false);
    };
    window.addEventListener(SOUND_EVENT, others);
    return () => {
      watcher.disconnect();
      window.removeEventListener(SOUND_EVENT, others);
    };
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.muted = !sound;
  }, [sound]);

  return (
    <>
      <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" aria-label={alt} className={className} />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const next = !sound;
          setSound(next);
          if (next) window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: ref.current }));
        }}
        aria-label={sound ? "Turn sound off" : "Turn sound on"}
        aria-pressed={sound}
        className="absolute left-3 top-16 z-[1] flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md md:top-3"
      >
        <SoundIcon on={sound} />
      </button>
    </>
  );
}
