import { defineSurfaceMap } from "@vigil/schemas";

export const stripeSurfaceMap = defineSurfaceMap({
  vendorId: "stripe",
  entries: [
    {
      contractPath: "POST /v1/charges",
      typescript: {
        calleePatterns: ["stripe.charges.create"]
      },
      python: {
        calleePatterns: ["stripe.Charge.create"]
      }
    }
  ]
});
