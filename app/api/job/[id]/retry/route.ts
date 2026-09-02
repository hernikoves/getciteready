import { NextResponse } from "next/server";
import { after } from "next/server";
import { getJob, patchJob, publicJob } from "@/lib/jobs";
import { runJob } from "@/lib/run-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!job.paid) {
    return NextResponse.json({ error: "retry is for paid jobs" }, { status: 400 });
  }
  patchJob(id, { status: "submitting", error: undefined, zip: undefined });
  after(() => runJob(id));
  const next = getJob(id)!;
  return NextResponse.json({ id, ...publicJob(next) });
}
