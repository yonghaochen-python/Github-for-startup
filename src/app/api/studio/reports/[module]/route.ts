import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requestIdFrom } from "@/lib/credits";
import { isStudioModule } from "@/lib/studioModules";
import { ReportError, deleteReport, generateReport, moduleReports } from "@/lib/studioReports";

const noStore = { "cache-control": "no-store" };
type Ctx = { params: Promise<{ module: string }> };

async function setUp(request: Request, ctx: Ctx) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return { res: res as Response };
  }
  const { module } = await ctx.params;
  if (!isStudioModule(module)) return { res: NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore }) };
  return { user, module };
}

/** A module's newest report (or ?id= an earlier one) and its history. Reading a report never generates one. */
export async function GET(request: Request, ctx: Ctx) {
  const { user, module, res } = await setUp(request, ctx);
  if (!user) return res;
  const id = new URL(request.url).searchParams.get("id") ?? undefined;
  return NextResponse.json(await moduleReports(user.id, module, id), { headers: noStore });
}

/** Makes a new report for this module, only when the person presses Analyze (or Regenerate). */
export async function POST(request: Request, ctx: Ctx) {
  const { user, module, res } = await setUp(request, ctx);
  if (!user) return res;
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { requestId?: unknown };
  try {
    const report = await generateReport(user.id, module, requestIdFrom(body.requestId));
    return NextResponse.json({ report }, { headers: noStore });
  } catch (err) {
    const e = err instanceof ReportError ? err : new ReportError("failed", "This analysis couldn't be made right now. Please try again.");
    const status = e.code === "no_portrait" ? 400 : e.code === "busy" ? 409 : 502;
    return NextResponse.json({ error: e.message, code: e.code }, { status, headers: noStore });
  }
}

/** Deletes one of this person's reports (?id=). */
export async function DELETE(request: Request, ctx: Ctx) {
  const { user, res } = await setUp(request, ctx);
  if (!user) return res;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !(await deleteReport(user.id, id))) return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
