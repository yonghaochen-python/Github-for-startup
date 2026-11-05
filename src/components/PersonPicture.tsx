"use client";

import { useEffect, useState } from "react";
import { cropToPerson } from "@/lib/personCrop";

/**
 * A full-body picture shown head to toe, with the background beside the person trimmed away (found on the device).
 * The original shows until the trimmed one is ready, and stays if no person is found.
 */
export function PersonPicture({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [cropped, setCropped] = useState<{ src: string; url: string | null } | null>(null);

  useEffect(() => {
    let ignore = false;
    cropToPerson(src).then((url) => !ignore && setCropped({ src, url }));
    return () => {
      ignore = true;
    };
  }, [src]);

  const shown = cropped?.src === src && cropped.url ? cropped.url : src;
  // eslint-disable-next-line @next/next/no-img-element -- private, owner-only image
  // A new picture eases in (keyed by the picture, so each change animates once).
  return <img key={shown} src={shown} alt={alt} className={`animate-[picture-in_.45s_ease-out] motion-reduce:animate-none ${className}`} />;
}
