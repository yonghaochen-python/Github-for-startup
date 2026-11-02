"use client";

import { useCallback, useEffect, useState } from "react";
import { cropPortrait, preparePortrait } from "@/lib/portraitCheck";
import type { PortraitInfo, ReportSummary, StudioModuleId } from "@/lib/studioModules";

export type StudioState = { portrait: PortraitInfo | null; reports: Partial<Record<StudioModuleId, ReportSummary>> };

export const portraitUrl = (p: PortraitInfo | null) => (p ? `/api/studio/portrait?v=${p.version}` : null);

/** The Studio home's data (portrait and newest reports), and saving or removing the portrait. Nothing is generated here. */
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

  /** Checks the photo on the device, then saves it. Throws with a message the person can read. */
  const savePortrait = useCallback(async (photo: Blob, fromTryOnPhoto = false) => {
    const source = fromTryOnPhoto ? await cropPortrait(photo) : photo;
    if (!source) throw new Error("We couldn't find your face in your try-on photo. Upload a portrait instead.");
    const { blob, checks } = await preparePortrait(source);
    const form = new FormData();
    form.append("photo", blob, "portrait.jpg");
    form.append("checks", JSON.stringify(checks));
    const res = await fetch("/api/studio/portrait", { method: "PUT", body: form });
    const data = (await res.json().catch(() => ({}))) as { portrait?: PortraitInfo; error?: string };
    if (!res.ok || !data.portrait) throw new Error(data.error ?? "Couldn't save your portrait. Please try again.");
    setState((s) => (s ? { ...s, portrait: data.portrait! } : s));
  }, []);

  const removePortrait = useCallback(async () => {
    const res = await fetch("/api/studio/portrait", { method: "DELETE" });
    if (!res.ok) throw new Error("Couldn't remove your portrait. Please try again.");
    setState((s) => (s ? { ...s, portrait: null } : s));
  }, []);

  return { state, failed, reload, savePortrait, removePortrait };
}
