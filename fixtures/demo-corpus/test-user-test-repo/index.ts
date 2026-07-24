import stripe from "stripe";

async function chargeUser() {
  const result = await stripe.charges.create({
    amount: 2000,
    currency: "usd",
    source: "tok_mastercard", // obtained with Stripe.js
    description: "My First Test Charge (created for API docs)",
  });
  console.log(result);
}
