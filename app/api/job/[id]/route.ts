import { after } from "next/server";
import { getJob, publicJob, upsertJob } from "@/lib/jobs";
import { runJob } from "@/lib/run-job";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FALLBACK = { status: "submitting" as const, paid: true };

function sessionEmail(session: {
  customer_details?: { email?: string | null } | null;
  customer_email?: string | null;
}): string | undefined {
  const raw =
    session.customer_details?.email || session.customer_email || undefined;
  const email = typeof raw === "string" ? raw.trim() : "";
  return email || undefined;
}

function sessionPaid(session: {
  payment_status?: string | null;
  status?: string | null;
}): boolean {
  return session.payment_status === "paid" || session.status === "complete";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const existing = getJob(id);
  if (existing) return Response.json(publicJob(existing));

  const stripeClient = getStripeClient();
  if (!stripeClient) {
    // Stripe unset: preview keeps the panel in submitting.
    return Response.json(FALLBACK);
  }

  try {
    const session = await stripeClient.checkout.sessions.retrieve(id);
    if (!sessionPaid(session)) {
      return Response.json({ status: "submitting", paid: false });
    }
    const raced = getJob(id);
    if (raced) return Response.json(publicJob(raced));

    const url =
      typeof session.metadata?.url === "string"
        ? session.metadata.url.trim()
        : "";
    if (!url) return Response.json(FALLBACK);

    const email = sessionEmail(session);
    const job = upsertJob(id, url, true, email);
    after(() => runJob(id));
    return Response.json(publicJob(job));
  } catch {
    // Cannot tell (invalid id, Stripe error): keep submitting fallback.
    return Response.json(FALLBACK);
  }
}
