import { NextResponse } from "next/server";
import {
  deleteSessionByToken,
  readSessionToken,
  clearSessionCookieHeader,
  devSignedOutCookieHeader,
} from "@/lib/auth";

export async function POST(request: Request) {
  const token = readSessionToken(request);
  if (token) await deleteSessionByToken(token);

  const response = NextResponse.json({ ok: true });
  response.headers.append("set-cookie", clearSessionCookieHeader());
  const devCookie = devSignedOutCookieHeader(true);
  if (devCookie) response.headers.append("set-cookie", devCookie);
  return response;
}
