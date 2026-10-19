/** Longest name we accept; long enough for most full names, short enough to fit a greeting. */
export const MAX_DISPLAY_NAME = 40;

/**
 * Cleans a name typed by the person: trims it, collapses inner whitespace, removes control characters and
 * caps the length. Returns null for an empty name (meaning "no name set"), or undefined if the input isn't text.
 */
export function cleanDisplayName(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DISPLAY_NAME)
    .trim();
  return cleaned || null;
}
