export type JobStatus =
  | "idle"
  | "submitting"
  | "success"
  | "timeout"
  | "robots"
  | "too_large"
  | "not_html"
  | "rate_limit";

export type Job = {
  id: string;
  status: JobStatus;
  url: string;
  paid: boolean;
  email?: string;
  emailMasked?: string;
  error?: string;
  zip?: Uint8Array;
  createdAt: number;
};

type G = typeof globalThis & { __citereadyJobs?: Map<string, Job> };

function store(): Map<string, Job> {
  const g = globalThis as G;
  if (!g.__citereadyJobs) g.__citereadyJobs = new Map();
  return g.__citereadyJobs;
}

export function createJobId(): string {
  return crypto.randomUUID();
}

export function createJob(url: string, paid = true, email?: string): Job {
  const job: Job = {
    id: createJobId(),
    status: "submitting",
    url,
    paid,
    createdAt: Date.now(),
  };
  if (email) {
    job.email = email;
    job.emailMasked = maskEmail(email);
  }
  store().set(job.id, job);
  return job;
}

/** Unpaid job already over the free-preview cap. No fetch. */
export function createRateLimitedJob(url: string, id?: string): Job {
  const existing = id ? store().get(id) : undefined;
  if (existing) {
    existing.url = url;
    existing.paid = false;
    existing.status = "rate_limit";
    existing.error = undefined;
    existing.zip = undefined;
    store().set(existing.id, existing);
    return existing;
  }
  const job: Job = {
    id: id || createJobId(),
    status: "rate_limit",
    url,
    paid: false,
    createdAt: Date.now(),
  };
  store().set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return store().get(id);
}

export function upsertJob(
  id: string,
  url: string,
  paid = true,
  email?: string,
): Job {
  const existing = store().get(id);
  if (existing) {
    existing.url = url;
    existing.paid = paid;
    existing.status = "submitting";
    existing.error = undefined;
    existing.zip = undefined;
    if (email) {
      existing.email = email;
      existing.emailMasked = maskEmail(email);
    }
    store().set(id, existing);
    return existing;
  }
  const job: Job = {
    id,
    status: "submitting",
    url,
    paid,
    createdAt: Date.now(),
  };
  if (email) {
    job.email = email;
    job.emailMasked = maskEmail(email);
  }
  store().set(id, job);
  return job;
}

export function patchJob(id: string, patch: Partial<Job>): Job | undefined {
  const job = store().get(id);
  if (!job) return undefined;
  Object.assign(job, patch);
  store().set(id, job);
  return job;
}

export function publicJob(job: Job): {
  status: JobStatus;
  url: string;
  paid: boolean;
  emailMasked?: string;
  error?: string;
} {
  const out: {
    status: JobStatus;
    url: string;
    paid: boolean;
    emailMasked?: string;
    error?: string;
  } = {
    status: job.status,
    url: job.url,
    paid: job.paid,
  };
  if (job.status === "success" && job.emailMasked) {
    out.emailMasked = job.emailMasked;
  }
  if (job.status === "timeout" && job.error === "server") {
    out.error = "server";
  }
  return out;
}

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const first = local[0] ?? "x";
  return `${first}***${domain}`;
}
