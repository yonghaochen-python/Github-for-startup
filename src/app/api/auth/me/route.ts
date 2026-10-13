import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { purgeLegacySelfie } from "@/lib/legacySelfie";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (user?.selfieUrl) await purgeLegacySelfie(user.id, user.selfieUrl);
  return NextResponse.json({ user: user && { id: user.id, email: user.email } });
}
