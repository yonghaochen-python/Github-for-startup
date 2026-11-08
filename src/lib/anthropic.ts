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

/**
 * A running count of the tokens one request used across its Claude calls, so its real cost can be recorded.
 * Prices: Claude Sonnet 5, $2 per million input tokens and $10 per million output tokens (cached input is billed
 * at 1.25× to write and 0.1× to read).
 */
export type AiMeter = { inputTokens: number; outputTokens: number; costMicros: number };
export const newMeter = (): AiMeter => ({ inputTokens: 0, outputTokens: 0, costMicros: 0 });

export function addUsage(meter: AiMeter | undefined, usage: Anthropic.Usage | null | undefined) {
  if (!meter || !usage) return;
  const input = usage.input_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  meter.inputTokens += input + write + read;
  meter.outputTokens += output;
  // $2 per million = 2 millionths of a dollar per token.
  meter.costMicros += Math.round(input * 2 + write * 2.5 + read * 0.2 + output * 10);
}
