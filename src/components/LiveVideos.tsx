"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";

type LiveVideo = { id: string; savedAt: string; size: number };

/**
 * Saved Looks: the live try-on videos the person chose to "Save to Virm". Private to them; each can be played,
 * downloaded or deleted. Shows nothing when there are none.
 */
export function LiveVideos() {
  const [videos, setVideos] = useState<LiveVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  // Videos removed from the list but not deleted yet: Undo brings them back; after 6 s (or on leaving) they're deleted.
  const pending = useRef(new Map<string, { video: LiveVideo; index: number; timer: ReturnType<typeof setTimeout> }>());

  useEffect(() => {
    let ignore = false;
    fetch("/api/me/live-videos", { cache: "no-store" })
      .then(async (res) => (res.ok ? (((await res.json()) as { videos?: LiveVideo[] }).videos ?? []) : []))
      .then((list) => !ignore && setVideos(list))
      .catch(() => !ignore && setVideos([]));
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const waiting = pending.current;
    const flush = () => {
      // Leaving the page: delete what's still waiting (keepalive lets the request finish after the page closes).
      for (const [id, { timer }] of waiting) {
        clearTimeout(timer);
        void fetch(`/api/me/live-videos/${id}`, { method: "DELETE", keepalive: true }).catch(() => {});
      }
      waiting.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  function putBack(video: LiveVideo, index: number) {
    setVideos((list) => {
      const next = [...(list ?? [])];
      if (next.some((v) => v.id === video.id)) return next;
      next.splice(Math.max(0, Math.min(index, next.length)), 0, video);
      return next;
    });
  }

  async function deleteNow(video: LiveVideo) {
    const entry = pending.current.get(video.id);
    pending.current.delete(video.id);
    const res = await fetch(`/api/me/live-videos/${video.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      putBack(video, entry?.index ?? 0);
      setError("Couldn't delete that video. Please try again.");
    }
  }

  function remove(video: LiveVideo) {
    setError(null);
    const index = (videos ?? []).findIndex((v) => v.id === video.id);
    setVideos((list) => (list ?? []).filter((v) => v.id !== video.id));
    const timer = setTimeout(() => void deleteNow(video), 6000);
    pending.current.set(video.id, { video, index, timer });
    showToast("Video deleted", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timer);
        pending.current.delete(video.id);
        putBack(video, index);
      },
    });
  }

  if (!videos?.length) return null;

  return (
    <section aria-labelledby="live-videos" className="mb-10">
      <h2 id="live-videos" className="text-[13px] font-semibold text-[#121821]">
        Live videos <span className="font-normal text-[#5d6874]">· only you can see these</span>
      </h2>
      {error && <p className="mt-2 text-[12.5px] text-[#a3261b]">{error}</p>}
      <ul className="mt-3 flex gap-4 overflow-x-auto pb-2">
        {videos.map((v) => (
          <li key={v.id} className="w-[220px] shrink-0 overflow-hidden rounded-[16px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_10px_28px_rgba(18,30,45,0.05)]">
            <video src={`/api/me/live-videos/${v.id}`} controls playsInline preload="metadata" className="aspect-video w-full bg-[#0b1520]" />
            <div className="flex items-center gap-3 px-3 py-2.5 text-[12px]">
              <span className="flex-1 text-[#5d6874]">{new Date(v.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <a href={`/api/me/live-videos/${v.id}?download=1`} className="font-semibold text-[#121821] underline-offset-4 hover:underline">
                Download
              </a>
              <button onClick={() => remove(v)} className="font-semibold text-[#a3261b] underline-offset-4 hover:underline">
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
