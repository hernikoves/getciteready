import { SAMPLE_PACK } from "@/lib/sample-pack";
import { zipStore } from "@/lib/zip-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const body = zipStore(SAMPLE_PACK);
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="citeready-sample.zip"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
