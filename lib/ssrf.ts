import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google.com",
  "metadata",
  "internal",
]);

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export class SsrfError extends HttpError {
  constructor(message = "url host is not allowed") {
    super(400, message);
    this.name = "SsrfError";
  }
}

function ipv4Private(ip: string): boolean {
  const p = ip.split(".").map((n) => Number(n));
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 255) return true;
  return false;
}

function ipv6Private(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fec0:")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice("::ffff:".length);
    if (mapped.includes(".")) return ipv4Private(mapped);
  }
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v === 6) return ipv6Private(ip);
  return true;
}

function blockedHostname(host: string): boolean {
  const h = host.replace(/\.$/, "").toLowerCase();
  if (!h) return true;
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h.endsWith(".arpa")) return true;
  if (h.includes("metadata.google")) return true;
  if (ipv4Private(h) && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)) return true;
  if (isIP(h) === 6 && ipv6Private(h)) return true;
  return false;
}

export function parseHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfError("invalid url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new SsrfError("only http/https urls are allowed");
  }
  if (u.username || u.password) throw new SsrfError("url userinfo is not allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (blockedHostname(host)) throw new SsrfError("url host is not allowed");
  return u;
}

export function sameHost(a: URL, b: URL): boolean {
  return (
    a.protocol === b.protocol &&
    a.hostname.toLowerCase() === b.hostname.toLowerCase() &&
    a.port === b.port
  );
}

export async function assertSafeUrl(raw: string, expectedHost?: string): Promise<URL> {
  const u = parseHttpUrl(raw);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (expectedHost) {
    const exp = expectedHost.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
    if (host.toLowerCase().replace(/\.$/, "") !== exp) {
      throw new SsrfError("redirect to a different host is not allowed");
    }
  }
  const ipKind = isIP(host);
  if (ipKind) {
    if (isPrivateIp(host)) throw new SsrfError("url host is not allowed");
    return u;
  }
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    for (const a of addrs) {
      if (isPrivateIp(a.address)) throw new SsrfError("url host is not allowed");
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
  }
  return u;
}

export const assertPublicHttpUrl = assertSafeUrl;
