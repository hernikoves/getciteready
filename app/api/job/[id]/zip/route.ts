import { getJob } from "@/lib/jobs";
import { toArrayBuffer } from "@/lib/zip-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) return Response.json({ error: "not found" }, { status: 404 });
  if (job.status !== "success" || !job.zip) {
    return Response.json(
      { error: "zip not ready", status: job.status },
      { status: 409 }
    );
  }
  return new Response(toArrayBuffer(job.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="citeready.zip"',
      "Cache-Control": "no-store",
    },
  });
}
