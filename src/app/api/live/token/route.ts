import { NextResponse } from "next/server";
import { createDecartClient } from "@decartai/sdk";
import { requireAdmin } from "@/lib/auth";

/**
 * Live Try On (preview): a short-lived Decart token for one real-time session, so the permanent key never reaches
 * the browser. Only for admin accounts (everyone else gets the camera-only prototype), and off unless
 * DECART_API_KEY is set. Each token can only run the try-on model, only from this site, for at most
 * MAX_SESSION_SECONDS (Decart ends the session itself), and each admin gets at most SESSIONS_PER_DAY sessions a day.
 */

const MAX_SESSION_SECONDS = 20;
const SESSIONS_PER_DAY = 10;
const MODEL = "lucy-vton-latest";
const noStore = { "cache-control": "private, no-store" };

// Sessions per person per day. Kept in memory: enough for local testing (it resets when the server restarts).
const used = new Map<string, { day: string; count: number }>();

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin(request);
  } catch (res) {
    return res as Response;
  }
  const apiKey = process.env.DECART_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Live try-on isn't connected." }, { status: 503, headers: noStore });

  const day = new Date().toISOString().slice(0, 10);
  const mine = used.get(user.id);
  const count = mine?.day === day ? mine.count : 0;
  if (count >= SESSIONS_PER_DAY) {
    return NextResponse.json({ error: `That's ${SESSIONS_PER_DAY} live sessions today. Try again tomorrow.` }, { status: 429, headers: noStore });
  }

  try {
    const client = createDecartClient({ apiKey, telemetry: false });
    const token = await client.tokens.create({
      expiresIn: 60,
      allowedModels: [MODEL],
      allowedOrigins: [new URL(request.url).origin],
      constraints: { realtime: { maxSessionDuration: MAX_SESSION_SECONDS } },
    });
    used.set(user.id, { day, count: count + 1 });
    return NextResponse.json({ apiKey: token.apiKey, model: MODEL, maxSeconds: MAX_SESSION_SECONDS }, { headers: noStore });
  } catch (err) {
    console.error("Couldn't create a Decart token:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Couldn't start live try-on right now." }, { status: 502, headers: noStore });
  }
}
