import { getJob, publicJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) {
    return Response.json({ status: "submitting", paid: true });
  }
  return Response.json(publicJob(job));
}
