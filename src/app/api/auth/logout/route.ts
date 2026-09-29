import { NextResponse } from "next/server";
import { deleteSessionByToken, readSessionToken, clearSessionCookieHeader } from "@/lib/auth";

export async function POST(request: Request) {
  const token = readSessionToken(request);
  if (token) await deleteSessionByToken(token);

  const response = NextResponse.json({ ok: true });
  response.headers.set("set-cookie", clearSessionCookieHeader());
  return response;
}
