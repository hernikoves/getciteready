import Stripe from "stripe";

/** Lazy StripeClient so missing STRIPE_SECRET_KEY does not break `next build`. */
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const StripeClient = new Stripe(key);
  return StripeClient;
}
