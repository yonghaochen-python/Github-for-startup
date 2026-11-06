/**
 * Records the live AI try-on video (the stream Decart sends back) in the browser, for a replay right after the
 * session. Everything stays in this page's memory: nothing is uploaded, stored or downloaded unless the person
 * chooses Download or Share. Video only (the live stream has no sound).
 */

// Best first: MP4 (H.264) plays almost everywhere and shares to most apps; WebM where MP4 can't be recorded.
const RECORDING_TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

/** The best video type this browser can record, or null if it can't record at all. */
export function pickRecordingType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export type LiveRecording = {
  /** Stops recording and returns the video as a file, or null if nothing usable was recorded. */
  stop: () => Promise<File | null>;
  /** Stops and throws the recording away. */
  discard: () => void;
};

/**
 * The stream flipped left to right, so the saved video looks like the mirrored live view: each frame is drawn
 * mirrored onto a canvas, and the canvas is recorded. Falls back to the stream as it is if the browser can't.
 */
function mirrored(stream: MediaStream): { stream: MediaStream; stop: () => void } {
  const plain = { stream, stop: () => {} };
  if (typeof document === "undefined") return plain;
  const canvas = document.createElement("canvas");
  if (typeof canvas.captureStream !== "function") return plain;
  const ctx = canvas.getContext("2d");
  if (!ctx) return plain;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  video.play().catch(() => {});
  let running = true;
  const draw = () => {
    if (!running) return;
    if (video.videoWidth) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
      ctx.drawImage(video, 0, 0);
    }
    // Timers keep going when the tab is in the background (animation frames would pause).
    setTimeout(draw, 1000 / 30);
  };
  draw();
  return {
    stream: canvas.captureStream(30),
    stop: () => {
      running = false;
      video.pause();
      video.srcObject = null;
    },
  };
}

/** Starts recording a stream (saved mirrored, like the live view), or returns null if this browser can't. */
export function startRecording(stream: MediaStream): LiveRecording | null {
  const type = pickRecordingType();
  if (!type) return null;
  const flipped = mirrored(stream);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(flipped.stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
  } catch {
    flipped.stop();
    return null;
  }
  let chunks: Blob[] = [];
  let failed = false;
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onerror = () => (failed = true);
  try {
    recorder.start(1000);
  } catch {
    flipped.stop();
    return null;
  }
  const baseType = type.split(";")[0];
  const ext = baseType === "video/mp4" ? "mp4" : "webm";

  return {
    stop: () =>
      new Promise((resolve) => {
        const finish = () => {
          flipped.stop();
          const blob = new Blob(chunks, { type: baseType });
          chunks = [];
          const day = new Date().toISOString().slice(0, 10);
          resolve(failed || blob.size === 0 ? null : new File([blob], `virm-live-try-on-${day}.${ext}`, { type: baseType }));
        };
        if (recorder.state === "inactive") return finish();
        recorder.onstop = finish;
        try {
          recorder.stop();
        } catch {
          finish();
        }
      }),
    discard: () => {
      flipped.stop();
      recorder.ondataavailable = null;
      recorder.onstop = null;
      chunks = [];
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {}
    },
  };
}
