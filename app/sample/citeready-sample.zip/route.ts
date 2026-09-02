import { readFileSync } from "node:fs";
import { join } from "node:path";
import { zipStore } from "@/lib/zip-store";

export const runtime = "nodejs";

const NAMES = [
  "llms.txt",
  "llms-full.txt",
  "faq.jsonld",
  "qa.md",
  "gaps.md",
  "README.txt",
] as const;

export function GET() {
  const dir = join(process.cwd(), "public/sample/_pack");
  const files: Record<string, string> = {};
  for (const name of NAMES) {
    files[name] = readFileSync(join(dir, name), "utf8");
  }
  const body = zipStore(files);
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="citeready-sample.zip"',
      "Content-Length": String(body.length),
    },
  });
}
