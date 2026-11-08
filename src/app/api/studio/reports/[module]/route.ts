import { NextResponse, after } from "next/server";
import { trackOncePerHour } from "@/lib/analytics";
import { asResponse, requireUser } from "@/lib/auth";
import { requestIdFrom } from "@/lib/credits";
import { isStudioModule } from "@/lib/studioModules";
import { ReportError, deleteReport, generateReport, moduleReports, updateStyleLook } from "@/lib/studioReports";

const noStore = { "cache-control": "no-store" };
type Ctx = { params: Promise<{ module: string }> };

async function setUp(request: Request, ctx: Ctx) {
  let user;
  try {
    user = await requireUser(request);
  } catch (res) {
    return { res: asResponse(res) };
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
  const reports = await moduleReports(user.id, module, id);
  // Reopening a saved report is free; counted (once an hour) so free reuse shows apart from new reports.
  if (reports.report) await trackOncePerHour(user.id, "report_opened").catch(() => {});
  return NextResponse.json(reports, { headers: noStore });
}

/** Makes a new report for this module: when the person opens one not made for their photo, or after a new photo. */
export async function POST(request: Request, ctx: Ctx) {
  const { user, module, res } = await setUp(request, ctx);
  if (!user) return res;
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { requestId?: unknown };
  try {
    // Kept running after the response too, so leaving the page doesn't lose a report that's being made.
    const job = generateReport(user, module, requestIdFrom(body.requestId));
    after(job.catch(() => {}));
    const report = await job;
    return NextResponse.json({ report }, { headers: noStore });
  } catch (err) {
    const e = err instanceof ReportError ? err : new ReportError("failed", "This analysis couldn't be made right now. Please try again.");
    const status = { no_portrait: 400, not_ready: 422, unusable: 422, no_credits: 402, busy: 409, failed: 502 }[e.code];
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

/** Saves the Style report's closet look after a piece is swapped or taken out (?id=). */
export async function PATCH(request: Request, ctx: Ctx) {
  const { user, module, res } = await setUp(request, ctx);
  if (!user) return res;
  const id = new URL(request.url).searchParams.get("id");
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { pieces?: unknown };
  if (module !== "style" || !id || !Array.isArray(body.pieces)) return NextResponse.json({ error: "Nothing to change." }, { status: 400, headers: noStore });
  const report = await updateStyleLook(user.id, id, body.pieces);
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  return NextResponse.json({ report }, { headers: noStore });
}
