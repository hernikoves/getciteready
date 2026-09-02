const g = globalThis as unknown as {
  __citereadyRl?: Map<string, number[]>;
};
if (!g.__citereadyRl) g.__citereadyRl = new Map();
const hits = g.__citereadyRl;

const WINDOW_MS = 10 * 60 * 1000;
const MAX = 8;

export function rateLimited(ip: string): boolean {
  const now = Date.now();
  const prev = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (prev.length >= MAX) {
    hits.set(ip, prev);
    return true;
  }
  prev.push(now);
  hits.set(ip, prev);
  return false;
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}
