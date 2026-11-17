"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/Dialog";
import { BookmarkIcon, CameraIcon, SparkleIcon, VideoIcon } from "@/components/Icons";

/**
 * Posting starts here: the ＋ in the phone's bottom bar and Create on computers open this sheet. Four ways to post,
 * none of them AI: your own photo, a video (a try-on or any outfit video), one of your saved looks, or an outfit
 * built from pieces.
 *
 * A photo or video is chosen right here (a phone only opens its picker straight from a tap), then handed to the New
 * post page in memory: it never leaves the device until Post is pressed.
 */

let handedPhoto: File | null = null;
let handedVideo: File | null = null;
/** Counts choices, so each one opens a fresh New post page. */
let visits = 0;
/** The photo picked in the ＋ menu, taken once by the New post page. */
export function takeHandedPhoto(): File | null {
  const file = handedPhoto;
  handedPhoto = null;
  return file;
}

/** The video picked in the ＋ menu, taken once by the New post page. */
export function takeHandedVideo(): File | null {
  const file = handedVideo;
  handedVideo = null;
  return file;
}

export type CreateStart = "photo" | "video" | "look" | "build";
export const CREATE_OPTIONS: { start: CreateStart; title: string; sub: string; Icon: typeof CameraIcon }[] = [
  { start: "photo", title: "Upload a photo", sub: "Your own outfit picture", Icon: CameraIcon },
  { start: "video", title: "Upload a video", sub: "A try-on or outfit video, up to a minute", Icon: VideoIcon },
  { start: "look", title: "Share a saved look", sub: "One of your try-ons", Icon: BookmarkIcon },
  { start: "build", title: "Build an outfit", sub: "Arrange pieces on a board", Icon: SparkleIcon },
];

export function CreateOptionRow({ title, sub, Icon, onClick }: { title: string; sub: string; Icon: typeof CameraIcon; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-[18px] p-3 text-left transition-colors hover:bg-[#f6f5f2] active:bg-[#f1efeb]">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-[#121821] text-white">
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15.5px] font-semibold text-[#121821]">{title}</span>
        <span className="block text-[12.5px] text-[#5d6874]">{sub}</span>
      </span>
    </button>
  );
}

export function CreateMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const videoInput = useRef<HTMLInputElement | null>(null);

  function choose(start: CreateStart) {
    if (start === "photo") return fileInput.current?.click();
    if (start === "video") return videoInput.current?.click();
    onClose();
    router.push(`/create?start=${start}&n=${++visits}`);
  }

  return createPortal(
    <Dialog label="Create a post" onClose={onClose} className="w-full max-w-sm rounded-[24px] bg-white p-3 pb-4 shadow-xl">
      <div className="flex items-center justify-between px-3 pb-1 pt-1">
        <h2 className="font-display text-[26px] leading-none text-[#121821]">Create</h2>
        <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-[22px] text-[#5d6874]">
          ×
        </button>
      </div>
      <ul className="mt-1">
        {CREATE_OPTIONS.map((o) => (
          <li key={o.start}>
            <CreateOptionRow title={o.title} sub={o.sub} Icon={o.Icon} onClick={() => choose(o.start)} />
          </li>
        ))}
      </ul>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          handedPhoto = file;
          onClose();
          router.push(`/create?start=photo&n=${++visits}`);
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          handedVideo = file;
          onClose();
          router.push(`/create?start=video&n=${++visits}`);
        }}
      />
    </Dialog>,
    document.body
  );
}
