import { defineSurfaceMap } from "@vigil/schemas";

export const twilioSurfaceMap = defineSurfaceMap({
  vendorId: "twilio",
  entries: [
    {
      contractPath: "POST /2010-04-01/Accounts/{AccountSid}/Messages.json",
      typescript: {
        calleePatterns: ["client.messages.create"]
      },
      python: {
        calleePatterns: ["client.messages.create"]
      }
    }
  ]
});
