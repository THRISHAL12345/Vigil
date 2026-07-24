import { defineSurfaceMap } from "@vigil/schemas";

export const stripeSurfaceMap = defineSurfaceMap({
  vendorId: "stripe",
  entries: [
    {
      contractPath: "POST /v1/charges",
      typescript: { calleePatterns: ["stripe.charges.create"] },
      python: { calleePatterns: ["stripe.Charge.create"] }
    },
    {
      contractPath: "POST /v1/customers",
      typescript: { calleePatterns: ["stripe.customers.create"] },
      python: { calleePatterns: ["stripe.Customer.create"] }
    },
    {
      contractPath: "POST /v1/payment_intents",
      typescript: { calleePatterns: ["stripe.paymentIntents.create"] },
      python: { calleePatterns: ["stripe.PaymentIntent.create"] }
    },
    {
      contractPath: "POST /v1/subscriptions",
      typescript: { calleePatterns: ["stripe.subscriptions.create"] },
      python: { calleePatterns: ["stripe.Subscription.create"] }
    },
    {
      contractPath: "POST /v1/refunds",
      typescript: { calleePatterns: ["stripe.refunds.create"] },
      python: { calleePatterns: ["stripe.Refund.create"] }
    }
  ]
});
