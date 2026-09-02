const g = globalThis as unknown as {
  __citereadyRl?: Map<string, number[]>;
};
if (!g.__citereadyRl) g.__citereadyRl = new Map();
const hits = g.__citereadyRl;

/** 3 free previews per client per UTC day. In-memory Map (same as jobs). */
const MAX = 3;

function utcDayKey(ip: string, now = Date.now()): string {
  return `${ip}:${new Date(now).toISOString().slice(0, 10)}`;
}

function prune(now: number): void {
  const today = new Date(now).toISOString().slice(0, 10);
  for (const key of hits.keys()) {
    const day = key.slice(key.lastIndexOf(":") + 1);
    if (day && day < today) hits.delete(key);
  }
}

/**
 * Consume one preview slot. Returns true if the request is blocked
 * (already 3 today — 4th is rate_limit, no fetch).
 */
export function rateLimited(ip: string): boolean {
  const now = Date.now();
  prune(now);
  const key = utcDayKey(ip, now);
  const prev = hits.get(key) || [];
  if (prev.length >= MAX) {
    hits.set(key, prev);
    return true;
  }
  prev.push(now);
  hits.set(key, prev);
  return false;
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}
