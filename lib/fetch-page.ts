import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { assertSafeUrl, HttpError, sameHost } from "@/lib/ssrf";
import { isPathAllowed } from "@/lib/robots";

const TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = Math.floor(1.5 * 1024 * 1024);
const MAX_REDIRECTS = 5;
const FALLBACK_UA = "CiteReady/1.0 (+https://getciteready.vercel.app)";

export { HttpError };

export function userAgent(): string {
  const v = process.env.CITEREADY_USER_AGENT;
  return v && v.trim() ? v.trim() : FALLBACK_UA;
}

export type PageLink = { href: string; text: string };

export type FetchedPage = {
  url: URL;
  html: string;
  title: string;
  pageText: string;
  links: PageLink[];
};

function timeoutSignal(parent?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(TIMEOUT_MS);
  if (!parent) return t;
  const c = new AbortController();
  const abort = () => c.abort();
  if (parent.aborted || t.aborted) {
    c.abort();
    return c.signal;
  }
  parent.addEventListener('abort', abort, { once: true });
  t.addEventListener('abort', abort, { once: true });
  return c.signal;
}

async function nativeFetch(url: string, signal?: AbortSignal): Promise<Response> {
  return fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      "User-Agent": userAgent(),
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    },
    signal: timeoutSignal(signal),
  });
}

async function readLimited(res: Response): Promise<Uint8Array> {
  const cl = res.headers.get("content-length");
  if (cl && /^\d+$/.test(cl) && Number(cl) > MAX_HTML_BYTES) {
    throw new HttpError(413, "HTML too large");
  }
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_HTML_BYTES) throw new HttpError(413, "HTML too large");
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      throw new HttpError(413, "HTML too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function wrapFetchError(err: unknown): never {
  if (err instanceof HttpError) throw err;
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    throw new HttpError(504, "fetch timed out");
  }
  throw new HttpError(502, "failed to fetch url");
}

async function fetchSameHost(
  start: URL,
  maxBytesCheck: boolean,
  signal?: AbortSignal,
): Promise<{ url: URL; status: number; body: Uint8Array; res: Response }> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(current.href);
    let res: Response;
    try {
      res = await nativeFetch(current.href, signal);
    } catch (err) {
      wrapFetchError(err);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new HttpError(502, "redirect without location");
      let next: URL;
      try {
        next = new URL(loc, current);
      } catch {
        throw new HttpError(400, "invalid redirect");
      }
      if (!sameHost(current, next)) {
        throw new HttpError(400, "redirect to a different host is not allowed");
      }
      await assertSafeUrl(next.href);
      current = next;
      continue;
    }
    const body = maxBytesCheck ? await readLimited(res) : new Uint8Array(await res.arrayBuffer());
    return { url: current, status: res.status, body, res };
  }
  throw new HttpError(400, "too many redirects");
}

function looksLikeHtml(bytes: Uint8Array): boolean {
  const head = decodeUtf8(bytes.slice(0, 1024)).replace(/^\uFEFF/, "").trimStart();
  return /<!doctype\s+html|<html|<body|<head/i.test(head);
}

function isHtmlContentType(res: Response, body: Uint8Array): boolean {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("text/html") || ct.includes("application/xhtml")) return true;
  if (
    ct.includes("application/pdf") ||
    ct.startsWith("image/") ||
    ct.startsWith("audio/") ||
    ct.startsWith("video/") ||
    ct.includes("application/zip") ||
    ct.includes("application/octet-stream") ||
    ct.includes("application/json")
  ) {
    return looksLikeHtml(body);
  }
  if (!ct || ct.includes("text/plain") || ct.includes("text/xml") || ct.includes("application/xml")) {
    return looksLikeHtml(body);
  }
  return looksLikeHtml(body);
}

const SKIP_EXT = /\.(css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|mp3|zip|pdf|json)$/i;

export function extractPage(html: string, pageUrl: URL): Pick<FetchedPage, "title" | "pageText" | "links"> {
  const $ = cheerio.load(html);
  $("script,style,noscript,iframe").remove();
  const cheerioTitle =
    $("h1").first().text().trim() ||
    $("title").first().text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    pageUrl.hostname;

  const links: PageLink[] = [];
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href");
    if (!raw) return;
    let abs: URL;
    try {
      abs = new URL(raw, pageUrl);
    } catch {
      return;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
    if (abs.origin !== pageUrl.origin) return;
    if (SKIP_EXT.test(abs.pathname)) return;
    const href = abs.href;
    if (seen.has(href)) return;
    seen.add(href);
    const text = $(el).text().replace(/\s+/g, " ").trim() || abs.pathname;
    links.push({ href, text: text.slice(0, 120) });
  });
  if (!seen.has(pageUrl.href)) {
    seen.add(pageUrl.href);
    links.unshift({ href: pageUrl.href, text: cheerioTitle || "This page" });
  }

  let pageText = "";
  let title = cheerioTitle;
  try {
    const dom = new JSDOM(html, { url: pageUrl.href, pretendToBeVisual: false });
    const article = new Readability(dom.window.document).parse();
    if (article?.title) title = article.title.trim() || title;
    if (article?.textContent) pageText = article.textContent.replace(/\r\n/g, "\n");
    dom.window.close();
  } catch {
    /* extractive fallback below */
  }
  if (!pageText.trim()) {
    pageText = $("body").text() || $.root().text();
  }
  const extras: string[] = [];
  $("details").each((_, el) => {
    const q = $(el).find("summary").first().text().replace(/\s+/g, " ").trim();
    const clone = $(el).clone();
    clone.find("summary").remove();
    const a = clone.text().replace(/\s+/g, " ").trim();
    if (q && a) extras.push((q.endsWith("?") ? q : q + "?") + "\n" + a);
  });
  $("h1,h2,h3,h4").each((_, el) => {
    const q = $(el).text().replace(/\s+/g, " ").trim();
    if (!q.endsWith("?") || q.length < 8) return;
    let a = "";
    let n = $(el).next();
    for (let i = 0; i < 5 && n.length; i++) {
      const tag = String(n.prop("tagName") || "").toLowerCase();
      if (/^h[1-4]$/.test(tag)) break;
      a += " " + n.text();
      n = n.next();
    }
    a = a.replace(/\s+/g, " ").trim();
    if (a) extras.push(q + "\n" + a);
  });
  if (extras.length) pageText = pageText + "\n\n" + extras.join("\n\n");
  pageText = pageText.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return { title: title || pageUrl.hostname, pageText, links };
}

/** GET robots.txt on the same host, then fetch the page HTML. */
export async function fetchPage(rawUrl: string, signal?: AbortSignal): Promise<FetchedPage> {
  const target = await assertSafeUrl(rawUrl);
  const robotsUrl = new URL("/robots.txt", `${target.protocol}//${target.host}`);
  try {
    const robots = await fetchSameHost(robotsUrl, false, signal);
    if (robots.status >= 200 && robots.status < 300) {
      const text = decodeUtf8(robots.body);
      const path = target.pathname + target.search;
      if (!isPathAllowed(text, path || "/")) {
        throw new HttpError(403, "blocked by robots.txt");
      }
    }
  } catch (err) {
    if (err instanceof HttpError && err.status === 403 && err.message.includes("robots")) throw err;
    // Missing robots.txt, timeouts, or 4xx: allow the page fetch.
  }

  const page = await fetchSameHost(target, true, signal);
  if (page.status === 401 || page.status === 403) {
    throw new HttpError(400, "not public html");
  }
  if (page.status >= 500) {
    throw new HttpError(502, `page returned ${page.status}`);
  }
  if (page.status >= 400) {
    throw new HttpError(400, "not public html");
  }
  if (!isHtmlContentType(page.res, page.body)) {
    throw new HttpError(400, "not public html");
  }
  const html = decodeUtf8(page.body);
  if (!looksLikeHtml(page.body) && !/html/i.test(page.res.headers.get("content-type") || "")) {
    throw new HttpError(400, "not public html");
  }
  const extracted = extractPage(html, page.url);
  if (!extracted.pageText.trim()) {
    throw new HttpError(422, "empty PAGE_TEXT (SPA/out of scope)");
  }
  // Do not persist HTML (never write it to disk; drop the string after extract).
  return { url: page.url, html: "", ...extracted };
}

export function mapFetchToStatus(err: unknown): {
  status: "timeout" | "robots" | "too_large" | "not_html";
  error?: string;
} {
  if (err instanceof HttpError) {
    if (err.status === 413) return { status: "too_large" };
    if (err.status === 504) return { status: "timeout" };
    if (err.status === 403 && err.message.includes("robots")) return { status: "robots" };
    if (err.status >= 500) return { status: "timeout", error: "server" };
    return { status: "not_html" };
  }
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return { status: "timeout" };
  }
  return { status: "timeout", error: "server" };
}
