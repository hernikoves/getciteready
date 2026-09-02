import { fetchPage, mapFetchToStatus } from "@/lib/fetch-page";
import { buildPackZip } from "@/lib/pack";
import { getJob, patchJob } from "@/lib/jobs";
import { emailZip } from "@/lib/email-zip";

const JOB_MS = 12_000;

export async function runJob(id: string): Promise<void> {
  const job = getJob(id);
  if (!job) return;
  patchJob(id, { status: "submitting", error: undefined, zip: undefined });
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), JOB_MS);
  try {
    const page = await fetchPage(job.url, ac.signal);
    const zip = await buildPackZip(page);
    const email = job.email;
    if (email) {
      await emailZip({ to: email, zip, url: job.url });
    }
    patchJob(id, {
      status: "success",
      zip,
      url: page.url.href,
      error: undefined,
    });
  } catch (err) {
    const mapped = mapFetchToStatus(err);
    patchJob(id, { status: mapped.status, error: mapped.error, zip: undefined });
  } finally {
    clearTimeout(timer);
  }
}
