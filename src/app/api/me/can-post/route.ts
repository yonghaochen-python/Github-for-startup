import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUserPost } from "@/lib/posts";

/** Whether this account may post now, and its username (needed before the first post). */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { username: true } });
  return NextResponse.json({ canPost: await canUserPost(user), username: me?.username ?? null }, { headers: { "cache-control": "private, no-store" } });
}
