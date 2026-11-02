import { randomUUID } from "node:crypto";
import { env } from "cloudflare:workers";
import type { PortraitChecks, PortraitInfo } from "@/lib/studioModules";

/**
 * The person's Studio portrait (head and shoulders), used for the Studio analyses. It's kept apart from the
 * full-body try-on photo, so changing one never affects the other. One per person, at a fixed private key that
 * only the owner can read (through /api/studio/portrait); its version and the device's quality checks live in the
 * object's metadata, so no database column is needed.
 */
const portraitKey = (userId: string) => `private/portraits/${userId}`;

export const PORTRAIT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PORTRAIT_BYTES = 8 * 1024 * 1024;

export async function portraitInfo(userId: string): Promise<PortraitInfo | null> {
  const head = await env.UPLOADS.head(portraitKey(userId));
  if (!head) return null;
  let checks: PortraitChecks | null = null;
  try {
    checks = head.customMetadata?.checks ? (JSON.parse(head.customMetadata.checks) as PortraitChecks) : null;
  } catch {}
  return { version: head.customMetadata?.version ?? "1", checks };
}

export async function savePortrait(userId: string, bytes: Uint8Array, mediaType: string, checks: PortraitChecks | null): Promise<PortraitInfo> {
  const version = randomUUID().slice(0, 12);
  await env.UPLOADS.put(portraitKey(userId), bytes, {
    httpMetadata: { contentType: mediaType },
    customMetadata: { version, ...(checks ? { checks: JSON.stringify(checks) } : {}) },
  });
  return { version, checks };
}

export async function loadPortrait(userId: string): Promise<{ bytes: Uint8Array; mediaType: string; version: string } | null> {
  const object = await env.UPLOADS.get(portraitKey(userId));
  if (!object) return null;
  return {
    bytes: new Uint8Array(await object.arrayBuffer()),
    mediaType: object.httpMetadata?.contentType ?? "image/jpeg",
    version: object.customMetadata?.version ?? "1",
  };
}

export async function deletePortrait(userId: string): Promise<void> {
  await env.UPLOADS.delete(portraitKey(userId));
}
