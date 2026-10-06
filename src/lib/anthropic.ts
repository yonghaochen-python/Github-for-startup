import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const CLASSIFY_MODEL = "claude-sonnet-5";
export const OUTFIT_MODEL = "claude-sonnet-5";

/** Reads the text out of a non-streamed Claude response's first text content block (skipping any thinking blocks). */
export function firstText(message: Anthropic.Message): string {
  if (message.stop_reason === "max_tokens") {
    throw new Error("The AI response was cut off before it finished (max_tokens reached).");
  }
  const block = message.content.find((b) => b.type === "text");
  if (!block) {
    throw new Error(`Expected a text content block, got: ${JSON.stringify(message.content)}`);
  }
  return block.text;
}
