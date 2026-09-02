import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(req: Request) {
  const stripeClient = getStripeClient();
  const price = process.env.STRIPE_PRICE_ID;
  if (!stripeClient || !price) {
    return jsonError(503, "checkout unavailable");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "invalid json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(400, "invalid json");
  }
  const url =
    typeof (body as { url?: unknown }).url === "string"
      ? (body as { url: string }).url.trim()
      : "";
  if (!url) return jsonError(400, "url is required");

  const origin = new URL(req.url).origin;
  try {
    const session = await stripeClient.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/?job={CHECKOUT_SESSION_ID}#generate`,
      cancel_url: `${origin}/#generate`,
      metadata: { url },
    });
    if (!session.url) return jsonError(503, "checkout unavailable");
    return Response.json({ url: session.url, id: session.id });
  } catch {
    return jsonError(503, "checkout unavailable");
  }
}
