"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cropPortrait, preparePortrait } from "@/lib/portraitCheck";
import { portraitReadiness, type PortraitInfo, type ReportSummary, type StudioModuleId } from "@/lib/studioModules";

export type StudioState = { portrait: PortraitInfo | null; reports: Partial<Record<StudioModuleId, ReportSummary>>; generating?: StudioModuleId[] };

export const portraitUrl = (p: PortraitInfo | null) => (p ? `/api/studio/portrait?v=${p.version}` : null);

/**
 * The AI Stylist page's data (portrait, newest reports, and which are being made), and saving or removing the
 * portrait. A new photo remakes the reports the person already had, so the new ones are there to see.
 */
export function useStudio() {
  const [state, setState] = useState<StudioState | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    fetch("/api/studio")
      .then(async (res) => {
        if (!res.ok) throw new Error("studio");
        setState((await res.json()) as StudioState);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(reload, [reload]);

  // Reports on their way: check back until they're ready.
  const making = Boolean(state?.generating?.length);
  useEffect(() => {
    if (!making) return;
    const timer = setInterval(reload, 4000);
    return () => clearInterval(timer);
  }, [making, reload]);

  const latest = useRef(state);
  latest.current = state;

  /** Checks the photo on the device, then saves it. Throws with a message the person can read. */
  const savePortrait = useCallback(async (photo: Blob, fromTryOnPhoto = false) => {
    const source = fromTryOnPhoto ? await cropPortrait(photo) : photo;
    if (!source) throw new Error("We couldn't find your face in your try-on photo. Upload a portrait instead.");
    let { blob, checks } = await preparePortrait(source);
    // A full-body photo (face too small to read): zoom in on the head and shoulders instead of turning it down,
    // and keep the zoomed one only if the face then reads clearly.
    if (checks.face === "small") {
      const zoomed = await cropPortrait(source).catch(() => null);
      const prepared = zoomed ? await preparePortrait(zoomed).catch(() => null) : null;
      if (prepared?.checks.face === "clear") ({ blob, checks } = prepared);
    }
    const form = new FormData();
    form.append("photo", blob, "portrait.jpg");
    form.append("checks", JSON.stringify(checks));
    const res = await fetch("/api/studio/portrait", { method: "PUT", body: form });
    const data = (await res.json().catch(() => ({}))) as { portrait?: PortraitInfo; error?: string };
    if (!res.ok || !data.portrait) throw new Error(data.error ?? "Couldn't save your portrait. Please try again.");
    setState((s) => (s ? { ...s, portrait: data.portrait! } : s));
    // The reports made from the earlier photo are made again for this one (one photo credit each). They keep going
    // on the server if the page is left.
    if (portraitReadiness(data.portrait.checks ?? null).ready) {
      const redo = Object.keys(latest.current?.reports ?? {}) as StudioModuleId[];
      if (redo.length) {
        setState((s) => (s ? { ...s, generating: redo } : s));
        for (const module of redo) {
          fetch(`/api/studio/reports/${module}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId: crypto.randomUUID() }),
          })
            .catch(() => null)
            .finally(reload);
        }
      }
    }
    return data.portrait;
  }, [reload]);

  const removePortrait = useCallback(async () => {
    const res = await fetch("/api/studio/portrait", { method: "DELETE" });
    if (!res.ok) throw new Error("Couldn't remove your portrait. Please try again.");
    setState((s) => (s ? { ...s, portrait: null } : s));
  }, []);

  return { state, failed, reload, savePortrait, removePortrait };
}
