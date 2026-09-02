import { zipStore } from "@/lib/zip-store";
import type { FetchedPage, PageLink } from "@/lib/fetch-page";

export type QA = { question: string; answer: string; quote: string };

const PRICE = /(?:\$|€|£)\s?\d[\d,]*(?:\.\d+)?|\b\d+\s?(?:usd|eur|gbp)\b/gi;

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function sentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.map(collapse).filter((s) => s.length > 20);
}

function includesQuote(pageText: string, quote: string): boolean {
  if (!quote || quote.length < 8) return false;
  if (pageText.includes(quote)) return true;
  const n = collapse(pageText);
  const q = collapse(quote);
  return n.includes(q) && (pageText.includes(q) || pageText.includes(quote));
}

function quoteOk(pageText: string, item: QA): boolean {
  if (!includesQuote(pageText, item.quote)) return false;
  const prices = item.answer.match(PRICE) || [];
  for (const p of prices) {
    if (!pageText.includes(p.trim()) && !item.quote.includes(p.trim())) return false;
  }
  return true;
}

function firstParagraph(pageText: string): string {
  const p = pageText.split(/\n\n+/)[0] || pageText;
  return collapse(p).slice(0, 280);
}

function extractiveQAs(page: FetchedPage): QA[] {
  const pageText = page.pageText;
  const out: QA[] = [];
  const seenQ = new Set<string>();

  const add = (question: string, answer: string, quote: string) => {
    const item: QA = {
      question: collapse(question).slice(0, 200),
      answer: collapse(answer).slice(0, 600),
      quote: quote.trim(),
    };
    if (!item.question || !item.answer || !item.quote) return;
    const key = item.question.toLowerCase();
    if (seenQ.has(key)) return;
    const nSents = sentences(item.answer).length || (item.answer ? 1 : 0);
    if (nSents < 2) {
      const extra = sentences(pageText).filter((s) => s !== item.quote).slice(0, 2);
      if (extra.length) item.answer = collapse(item.answer + " " + extra.join(" "));
    }
    const n2 = Math.max(sentences(item.answer).length, item.answer ? 1 : 0);
    if (n2 < 2 || n2 > 4) {
      const clipped = sentences(item.answer).slice(0, 4);
      if (clipped.length >= 2) item.answer = clipped.join(" ");
      else return;
    }
    if (!quoteOk(pageText, item)) return;
    seenQ.add(key);
    out.push(item);
  };

  const lines = pageText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 8 && line.length < 180 && line.endsWith("?")) {
      const ans = lines.slice(i + 1, i + 4).join(" ");
      const sents = sentences(ans);
      const quote = sents[0] || (pageText.includes(ans.slice(0, 80)) ? collapse(ans).slice(0, 180) : "");
      if (quote) add(line, collapse(ans).slice(0, 400) || quote, quote);
    }
    if (out.length >= 8) break;
  }

  if (out.length < 5) {
    const sents = sentences(pageText).slice(0, 24);
    if (sents[0]) {
      add(`What is ${page.title}?`, sents.slice(0, 2).join(" "), sents[0]);
    }
    for (const s of sents) {
      if (out.length >= 8) break;
      if (/\b(price|cost|pricing|\$|honor|robots|public|email|account|zip)\b/i.test(s)) {
        const q = /\?/.test(s)
          ? s
          : `What does the page say about ${collapse(s).split(" ").slice(0, 6).join(" ")}?`;
        add(q.replace(/\?+$/, "?"), s, s);
      }
    }
    for (const s of sents) {
      if (out.length >= 5) break;
      add(`What does ${page.title} state?`, s, s);
    }
  }

  return out.slice(0, 8);
}

async function openaiQAs(pageText: string, title: string): Promise<QA[] | null> {
  const openai = process.env.OPENAI_API_KEY;
  if (!openai) return null;
  const key = openai;
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const clipped = pageText.slice(0, 24_000);
  const body = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'Return JSON {"items":[{"question":string,"answer":string,"quote":string}]}. 5-8 items. Each quote MUST be a verbatim substring of PAGE_TEXT. Never invent prices, features, dates, or names. If a fact is not in PAGE_TEXT, omit the item. Answers 2-4 sentences using only PAGE_TEXT.',
      },
      {
        role: "user",
        content: `TITLE: ${title}\n\nPAGE_TEXT:\n${clipped}`,
      },
    ],
  };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { items?: unknown };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const qas: QA[] = [];
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const rec = it as Record<string, unknown>;
      const question = typeof rec.question === "string" ? rec.question : "";
      const answer = typeof rec.answer === "string" ? rec.answer : "";
      const quote = typeof rec.quote === "string" ? rec.quote : "";
      const qa: QA = { question, answer, quote };
      if (quoteOk(pageText, qa)) qas.push(qa);
    }
    return qas.length ? qas.slice(0, 8) : [];
  } catch {
    return null;
  }
}

function sectionLinks(links: PageLink[], origin: string): { heading: string; items: PageLink[] }[] {
  const unique = links.filter((l) => l.href.startsWith(origin)).slice(0, 16);
  const home: PageLink[] = [];
  const rest: PageLink[] = [];
  for (const l of unique) {
    try {
      const u = new URL(l.href);
      if (u.pathname === "/" || u.pathname === "") home.push(l);
      else rest.push(l);
    } catch {
      rest.push(l);
    }
  }
  const sections: { heading: string; items: PageLink[] }[] = [];
  if (home.length || rest.length) {
    sections.push({ heading: "Pages", items: [...home, ...rest].slice(0, 10) });
  }
  return sections;
}

function buildLlmsTxt(page: FetchedPage): string {
  const title = page.title || page.url.hostname;
  const bq = firstParagraph(page.pageText) || title;
  const origin = page.url.origin;
  const sections = sectionLinks(page.links, origin);
  const lines: string[] = [`# ${title}`, "", `> ${bq}`, ""];
  const intro = collapse(page.pageText).slice(0, 400);
  if (intro && intro !== bq) lines.push(intro, "");
  const self = `- [${title}](${page.url.href}): ${bq.slice(0, 120)}`;
  if (!sections.length) {
    lines.push("## Pages", self, "");
  } else {
    for (const sec of sections) {
      lines.push(`## ${sec.heading}`);
      for (const item of sec.items) {
        const desc = collapse(item.text).slice(0, 100);
        lines.push(`- [${desc || item.href}](${item.href}): ${desc || "On-site page"}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n").trim() + "\n";
}

function buildLlmsFull(page: FetchedPage): string {
  let body = page.pageText;
  if (body.length > 80_000) body = body.slice(0, 80_000) + "\n\n[truncated]\n";
  return `# ${page.title}\n\nSource: ${page.url.href}\n\n${body}\n`;
}

function buildFaqJsonLd(qas: QA[]): string {
  const mainEntity = qas.map((q) => ({
    "@type": "Question",
    name: q.question,
    acceptedAnswer: { "@type": "Answer", text: q.answer },
  }));
  return JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity }, null, 2) + "\n";
}

function buildQaMd(page: FetchedPage, qas: QA[]): string {
  const lines = [
    "# Q&A (grounded)",
    "",
    `Every answer includes a verbatim quote from ${page.url.href}. Items that could not quote PAGE_TEXT were omitted.`,
    "",
  ];
  qas.forEach((q, i) => {
    lines.push(`## ${i + 1}. ${q.question}`, "", q.answer, "", `- quote: \`${q.quote.replace(/`/g, "'")}\``, "");
  });
  return lines.join("\n");
}

function buildGaps(page: FetchedPage, qas: QA[]): string {
  const t = page.pageText;
  const hasNumber = /\b\d{2,}\b/.test(t);
  const hasDate = /\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i.test(t);
  const hasAuthor = /\b(?:by|author|written)\s+[A-Z][a-z]+/.test(t);
  const lines = [
    "# gaps.md",
    "",
    "Punch-list of what a model cannot cite from this page.",
    "",
    "## Missing numbers",
    hasNumber ? "- Some figures appear on the page; still check for customer counts or benchmarks." : "- No clear counts, benchmarks, or metrics on PAGE_TEXT.",
    "",
    "## Missing dates",
    hasDate ? "- A year or date-like token is present; confirm last-updated." : "- No last-updated timestamp or publication date on PAGE_TEXT.",
    "",
    "## Missing author",
    hasAuthor ? "- A byline-like phrase was found; confirm credentials." : "- No named person or credentials on PAGE_TEXT.",
    "",
    "## Grounded Q&As shipped",
    `- ${qas.length} item(s) included. Unquoted claims were omitted.`,
    "",
  ];
  return lines.join("\n");
}

function buildReadme(page: FetchedPage): string {
  return `# CiteReady pack
Source URL: ${page.url.href}

## Files
| File | Where to put it |
|---|---|
| llms.txt | Site root, Content-Type text/plain; charset=utf-8 |
| llms-full.txt | Site root (optional companion) |
| faq.jsonld | Inside <script type="application/ld+json"> on the page these questions appear on |
| qa.md | Editorial reference; do not upload as schema |
| gaps.md | Editorial punch-list; do not publish unless you want it public |
| README.txt | This file |

## Rules this pack already followed
- llms.txt: one H1, blockquote, then H2 lists with absolute URLs on the fetched origin.
- FAQPage answers only ship with a verbatim PAGE_TEXT quote.
- Items without a PAGE_TEXT quote were omitted.
- Prices were never invented.
`;
}

export async function buildPackFiles(page: FetchedPage): Promise<Record<string, string>> {
  let qas = extractiveQAs(page);
  const ai = await openaiQAs(page.pageText, page.title);
  if (ai && ai.length) qas = ai;
  if (qas.length > 8) qas = qas.slice(0, 8);
  return {
    "llms.txt": buildLlmsTxt(page),
    "llms-full.txt": buildLlmsFull(page),
    "faq.jsonld": buildFaqJsonLd(qas),
    "qa.md": buildQaMd(page, qas),
    "gaps.md": buildGaps(page, qas),
    "README.txt": buildReadme(page),
  };
}

export async function buildPackZip(page: FetchedPage): Promise<Uint8Array> {
  const files = await buildPackFiles(page);
  return zipStore(files);
}
