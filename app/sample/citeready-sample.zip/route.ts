import { SAMPLE_PACK } from "@/lib/sample-pack";
import { zipStore } from "@/lib/zip-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

export function GET() {
  const body = toArrayBuffer(zipStore(SAMPLE_PACK));
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="citeready-sample.zip"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
