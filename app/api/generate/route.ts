import { fetchPage, HttpError } from "@/lib/fetch-page";
import { buildPackZip } from "@/lib/pack";
import { toArrayBuffer } from "@/lib/zip-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(400, "invalid json");
  }
  const url = (body as { url?: unknown }).url;
  if (typeof url !== "string" || !url.trim()) {
    return jsonError(400, "url is required");
  }

  try {
    const page = await fetchPage(url.trim());
    if (!page.pageText.trim()) {
      return jsonError(422, "empty PAGE_TEXT (SPA/out of scope)");
    }
    const zip = await buildPackZip(page);
    page.html = "";
    return new Response(toArrayBuffer(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="citeready.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonError(err.status, err.message);
    }
    return jsonError(500, "generate failed");
  }
}
