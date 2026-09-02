import { after } from "next/server";
import { createJob, upsertJob, publicJob } from "@/lib/jobs";
import { runJob } from "@/lib/run-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(400, "invalid json");
  }
  const rec = body as { url?: unknown; jobId?: unknown };
  const url = typeof rec.url === "string" ? rec.url.trim() : "";
  const jobId = typeof rec.jobId === "string" ? rec.jobId.trim() : "";
  if (!url) return jsonError(400, "url is required");

  const job = jobId ? upsertJob(jobId, url, true) : createJob(url, true);
  after(() => runJob(job.id));
  return Response.json({
    jobId: job.id,
    id: job.id,
    ...publicJob(job),
  });
}
