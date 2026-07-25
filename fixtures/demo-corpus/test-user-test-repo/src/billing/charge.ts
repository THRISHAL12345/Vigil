import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function createCharge(amount: number, currency: string) {
  return stripe.charges.create({
    amount,
    currency,
  });
}
