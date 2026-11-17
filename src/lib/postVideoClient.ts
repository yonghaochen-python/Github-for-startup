"use client";

import { POST_VIDEO_MAX_BYTES, POST_VIDEO_MAX_SECONDS, POST_VIDEO_TYPES } from "@/lib/postRules";

/** Video posts, on the device: checking the video, taking its cover frame, and sending it with progress. */

export type ChosenVideo = { blob: Blob; type: string; url: string; width: number; height: number; ms: number; hevc: boolean };

/** The video's type (some phones leave it empty, so the file name decides). */
function typeOf(file: Blob & { name?: string }): string | null {
  if (POST_VIDEO_TYPES[file.type]) return file.type;
  const ext = (file.name ?? "").split(".").pop()?.toLowerCase();
  return ext === "mov" ? "video/quicktime" : ext === "mp4" || ext === "m4v" ? "video/mp4" : ext === "webm" ? "video/webm" : null;
}

/**
 * iPhones film in HEVC ("hvc1"/"hev1"), which some Android phones and older computers can't play. Looked for near
 * the start and end of the file (where the video's description sits).
 */
async function looksHevc(file: Blob): Promise<boolean> {
  const part = 1.5 * 1024 * 1024;
  const pieces = [file.slice(0, part), file.size > part ? file.slice(Math.max(part, file.size - part)) : null].filter(Boolean) as Blob[];
  for (const piece of pieces) {
    const text = new TextDecoder("latin1").decode(await piece.arrayBuffer());
    if (text.includes("hvc1") || text.includes("hev1")) return true;
  }
  return false;
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("This video can't be played here. Try an MP4."));
    video.src = url;
  });
}

/** The video's length in seconds. Recordings made in a browser often don't say; seeking far ahead makes them tell. */
async function lengthOf(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration)) return video.duration;
  await new Promise<void>((resolve) => {
    const done = () => {
      if (!Number.isFinite(video.duration)) return;
      video.ontimeupdate = null;
      video.ondurationchange = null;
      resolve();
    };
    video.ontimeupdate = done;
    video.ondurationchange = done;
    video.currentTime = 1e7;
    setTimeout(resolve, 4000);
  });
  const seconds = video.duration;
  video.currentTime = 0;
  return Number.isFinite(seconds) ? seconds : POST_VIDEO_MAX_SECONDS + 1;
}

/** Checks a chosen video (type, size, length, that it plays here) and reads its size and length. */
export async function readVideo(file: Blob & { name?: string }): Promise<ChosenVideo> {
  const type = typeOf(file);
  if (!type) throw new Error("Use an MP4, MOV or WebM video.");
  if (file.size > POST_VIDEO_MAX_BYTES) throw new Error("That video is over 50 MB. Try a shorter one.");
  const url = URL.createObjectURL(file);
  try {
    const video = await loadVideo(url);
    if (!video.videoWidth || !video.videoHeight) throw new Error("This video can't be played here. Try an MP4.");
    const seconds = await lengthOf(video);
    if (seconds > POST_VIDEO_MAX_SECONDS + 0.5) throw new Error(`Videos can be up to ${POST_VIDEO_MAX_SECONDS} seconds.`);
    const result = { blob: file, type, url, width: video.videoWidth, height: video.videoHeight, ms: Math.round(seconds * 1000), hevc: await looksHevc(file) };
    video.removeAttribute("src");
    video.load();
    return result;
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** One frame of the video as the post's cover picture (WebP, long side 1440 px or less). */
export async function grabFrame(url: string, seconds: number): Promise<{ blob: Blob; width: number; height: number }> {
  const video = await loadVideo(url);
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
    const end = Number.isFinite(video.duration) ? video.duration - 0.05 : seconds;
    video.currentTime = Math.max(0, Math.min(seconds, end));
  });
  const scale = Math.min(1, 1440 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  video.removeAttribute("src");
  video.load();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't take the cover."))), "image/webp", 0.86));
  return { blob, width: canvas.width, height: canvas.height };
}

/** Sends the video before the post (with progress from 0 to 1). Resolves to its storage key. */
export function uploadVideo(video: ChosenVideo, onProgress: (share: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/posts/video");
    xhr.setRequestHeader("content-type", video.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data: { key?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText) as typeof data;
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data.key) resolve(data.key);
      else reject(new Error(data.error ?? "Couldn't send the video. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Couldn't send the video. Check your connection and try again."));
    xhr.send(video.blob);
  });
}
