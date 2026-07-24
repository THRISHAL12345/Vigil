import { defineSurfaceMap } from "@vigil/schemas";

export const openaiSurfaceMap = defineSurfaceMap({
  vendorId: "openai",
  entries: [
    {
      contractPath: "POST /v1/chat/completions",
      typescript: {
        calleePatterns: ["openai.chat.completions.create"]
      },
      python: {
        calleePatterns: ["openai.ChatCompletion.create"]
      }
    }
  ]
});
