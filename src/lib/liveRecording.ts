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

/** Starts recording a stream, or returns null if this browser can't. */
export function startRecording(stream: MediaStream): LiveRecording | null {
  const type = pickRecordingType();
  if (!type) return null;
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
  } catch {
    return null;
  }
  let chunks: Blob[] = [];
  let failed = false;
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onerror = () => (failed = true);
  try {
    recorder.start(1000);
  } catch {
    return null;
  }
  const baseType = type.split(";")[0];
  const ext = baseType === "video/mp4" ? "mp4" : "webm";

  return {
    stop: () =>
      new Promise((resolve) => {
        const finish = () => {
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
      recorder.ondataavailable = null;
      recorder.onstop = null;
      chunks = [];
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {}
    },
  };
}
