import { addUsage, anthropic, CLASSIFY_MODEL, firstText, type AiMeter } from "@/lib/anthropic";
import type { ImageBytes } from "@/lib/tryOn/types";

/**
 * A quick look at a new try-on picture before the person sees it: is every chosen piece on them, and is nothing left
 * over from the clothes in their own photo (the try-on AI often keeps a top or shorts and fits the new pieces around
 * them)? Only used for outfits of two or more pieces, the ones that go wrong. One Claude call; its cost is recorded.
 * Never blocks a try-on: any trouble here returns null and the picture is shown as it is.
 */

type Piece = { role: string; description: string };

const SCHEMA = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    problems: { type: "array", items: { type: "string" } },
  },
  required: ["ok", "problems"],
  additionalProperties: false,
};

const TOP = ["base_layer", "mid_layer", "outer_layer"];

/** Which of the person's own clothes the outfit should have replaced (the rest may stay). */
function replaced(pieces: Piece[]): string {
  const has = (roles: string[]) => pieces.some((p) => roles.includes(p.role));
  const dress = has(["one_piece"]);
  const parts = [
    ...(dress || has(TOP) ? ["their top and any jacket"] : []),
    ...(dress || has(["bottom"]) ? ["their shorts, skirt or trousers"] : []),
    ...(has(["shoes"]) ? ["their shoes"] : []),
  ];
  return parts.length ? parts.join(", ") : "nothing";
}

function fromDataUrl(dataUrl: string): { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  return match ? { mediaType: match[1] as "image/jpeg" | "image/png" | "image/webp", data: match[2] } : null;
}

export type TryOnCheck = { ok: boolean; problems: string[] };

export async function checkTryOn(result: string, sheet: ImageBytes | undefined, pieces: Piece[], meter: AiMeter): Promise<TryOnCheck | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const picture = fromDataUrl(result);
  if (!picture) return null;
  const list = pieces.map((p, i) => `${i + 1}) ${p.description}`).join("\n");
  try {
    const message = await anthropic.messages.create({
      model: CLASSIFY_MODEL,
      max_tokens: 600,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: picture.mediaType, data: picture.data } },
            ...(sheet
              ? [
                  {
                    type: "image" as const,
                    source: { type: "base64" as const, media_type: sheet.mediaType as "image/jpeg" | "image/png" | "image/webp", data: Buffer.from(sheet.bytes).toString("base64") },
                  },
                ]
              : []),
            {
              type: "text",
              text:
                `The first picture is an AI virtual try-on: a person dressed in an outfit${sheet ? " (the second picture shows the outfit's pieces)" : ""}. The outfit is:\n${list}\n\n` +
                `It should have replaced ${replaced(pieces)} from the person's own photo. Check two things only:\n` +
                "1. Is every piece of the outfit clearly on the person, as that kind of garment (trousers still full trousers, not leggings under something; a top still the whole top, not just its sleeves)?\n" +
                "2. Is anything left over from the person's own clothes that should have been replaced (for example shorts or a skirt still worn over the new trousers, or their old top still on with the new top only showing at the sleeves)?\n" +
                "Ignore small differences in color, fit or detail, the background and the face. ok is true when both checks pass. " +
                "problems: short plain sentences, one per problem (empty when ok).",
            },
          ],
        },
      ],
    });
    addUsage(meter, message.usage);
    const parsed = JSON.parse(firstText(message)) as TryOnCheck;
    return { ok: Boolean(parsed.ok), problems: Array.isArray(parsed.problems) ? parsed.problems.map(String).slice(0, 5) : [] };
  } catch (err) {
    console.error("Try-on check failed:", err);
    return null;
  }
}
