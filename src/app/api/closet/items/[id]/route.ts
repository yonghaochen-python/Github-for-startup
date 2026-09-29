import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { CATEGORIES, FORMALITIES, SEASONS } from "@/lib/classify";

const EDITABLE_STRING_FIELDS = ["color", "pattern", "material", "description"] as const;

export async function PATCH(request: Request, ctx: RouteContext<"/api/closet/items/[id]">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const { id } = await ctx.params;
  const body: unknown = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: Record<string, string> = {};
  const b = body as Record<string, unknown>;

  if ("category" in b) {
    if (typeof b.category !== "string" || !CATEGORIES.includes(b.category as (typeof CATEGORIES)[number])) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    data.category = b.category;
  }
  if ("formality" in b) {
    if (typeof b.formality !== "string" || !FORMALITIES.includes(b.formality as (typeof FORMALITIES)[number])) {
      return NextResponse.json({ error: "Invalid formality." }, { status: 400 });
    }
    data.formality = b.formality;
  }
  if ("season" in b) {
    if (typeof b.season !== "string" || !SEASONS.includes(b.season as (typeof SEASONS)[number])) {
      return NextResponse.json({ error: "Invalid season." }, { status: 400 });
    }
    data.season = b.season;
  }
  for (const field of EDITABLE_STRING_FIELDS) {
    if (field in b) {
      if (typeof b[field] !== "string" || !b[field].trim()) {
        return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      }
      data[field] = b[field].trim();
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const existing = await prisma.clothingItem.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const item = await prisma.clothingItem.update({ where: { id }, data });
  return NextResponse.json({ item });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/closet/items/[id]">) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return res as Response;
  }

  const { id } = await ctx.params;
  await prisma.clothingItem.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
