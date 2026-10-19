import { NextResponse } from "next/server";
import { MIN_PASSWORD_LENGTH, resetPassword } from "@/lib/passwordReset";

const noStore = { "cache-control": "private, no-store" };

/** Sets a new password from a one-time reset link. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown; password?: unknown };
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400, headers: noStore });
  }
  if (!/^[0-9a-f]{64}$/.test(token) || (await resetPassword(token, password)) !== "ok") {
    return NextResponse.json(
      { error: "This link has expired or was already used. Ask for a new one." },
      { status: 400, headers: noStore }
    );
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
