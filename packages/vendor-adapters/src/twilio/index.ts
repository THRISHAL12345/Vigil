import { defineSurfaceMap } from "@vigil/schemas";

export const twilioSurfaceMap = defineSurfaceMap({
  vendorId: "twilio",
  entries: [
    {
      contractPath: "POST /2010-04-01/Accounts/{AccountSid}/Messages.json",
      typescript: { calleePatterns: ["client.messages.create"] },
      python: { calleePatterns: ["client.messages.create"] }
    },
    {
      contractPath: "POST /2010-04-01/Accounts/{AccountSid}/Calls.json",
      typescript: { calleePatterns: ["client.calls.create"] },
      python: { calleePatterns: ["client.calls.create"] }
    },
    {
      contractPath: "POST /2010-04-01/Accounts/{AccountSid}/Messages/{MessageSid}.json",
      typescript: { calleePatterns: ["client.messages(sid).update", "client.messages.update"] }, // Note: (sid) is hard to match statically, usually it's `client.messages('sid').update`
      python: { calleePatterns: ["client.messages.update"] }
    },
    {
      contractPath: "POST /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers.json",
      typescript: { calleePatterns: ["client.incomingPhoneNumbers.create"] },
      python: { calleePatterns: ["client.incomingPhoneNumbers.create"] }
    }
  ]
});
