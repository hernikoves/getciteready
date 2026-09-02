import { runJob } from "@/lib/run-job";

/** Paid generate/retry worker. URL is already on the job record. */
export async function runGenerate(jobId: string, _url?: string): Promise<void> {
  await runJob(jobId);
}
