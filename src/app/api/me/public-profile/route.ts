import { NextResponse } from "next/server";
import { asResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { avatarUrl, cleanBio, normalizeUsername, usernameProblem, usernameTaken } from "@/lib/profiles";

const noStore = { "cache-control": "private, no-store" };

/**
 * Your public profile: GET it; GET ?check=<name> says whether a username is free (as you type); PATCH { username?,
 * bio? } saves. Only these public fields change here.
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const check = new URL(request.url).searchParams.get("check");
  if (check !== null) {
    const name = normalizeUsername(check);
    const problem = usernameProblem(name) ?? ((await usernameTaken(name, user.id)) ? "That name is taken." : null);
    return NextResponse.json({ username: name, ok: !problem, problem }, { headers: noStore });
  }
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { username: true, bio: true, avatarKey: true, displayName: true } });
  return NextResponse.json({ username: row?.username ?? null, bio: row?.bio ?? null, displayName: row?.displayName ?? null, avatarUrl: avatarUrl(row?.avatarKey) }, { headers: noStore });
}

export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return asResponse(res);
  }
  const body = (await request.json().catch(() => ({}))) as { username?: unknown; bio?: unknown };
  const data: { username?: string; bio?: string | null } = {};
  if (body.username !== undefined) {
    const name = normalizeUsername(body.username);
    const problem = usernameProblem(name);
    if (problem) return NextResponse.json({ error: problem, field: "username" }, { status: 400, headers: noStore });
    if (await usernameTaken(name, user.id)) return NextResponse.json({ error: "That name is taken.", field: "username" }, { status: 409, headers: noStore });
    data.username = name;
  }
  if (body.bio !== undefined) {
    const bio = cleanBio(body.bio);
    if (bio === undefined) return NextResponse.json({ error: "That bio can't be saved.", field: "bio" }, { status: 400, headers: noStore });
    data.bio = bio;
  }
  try {
    const row = await prisma.user.update({ where: { id: user.id }, data, select: { username: true, bio: true } });
    return NextResponse.json(row, { headers: noStore });
  } catch {
    // Two people saving the same name at once: the database keeps it unique.
    return NextResponse.json({ error: "That name is taken.", field: "username" }, { status: 409, headers: noStore });
  }
}
