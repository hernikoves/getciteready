import { SAMPLE_ZIP_B64 } from "@/lib/sample-zip-b64";

export function GET() {
  const body = Buffer.from(SAMPLE_ZIP_B64, "base64");
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="citeready-sample.zip"',
      "Content-Length": String(body.length),
    },
  });
}
