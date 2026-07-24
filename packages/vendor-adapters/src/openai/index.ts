import { defineSurfaceMap } from "@vigil/schemas";

export const openaiSurfaceMap = defineSurfaceMap({
  vendorId: "openai",
  entries: [
    {
      contractPath: "POST /v1/chat/completions",
      typescript: { calleePatterns: ["openai.chat.completions.create"] },
      python: { calleePatterns: ["openai.ChatCompletion.create"] }
    },
    {
      contractPath: "POST /v1/embeddings",
      typescript: { calleePatterns: ["openai.embeddings.create"] },
      python: { calleePatterns: ["openai.Embedding.create"] }
    },
    {
      contractPath: "POST /v1/audio/transcriptions",
      typescript: { calleePatterns: ["openai.audio.transcriptions.create"] },
      python: { calleePatterns: ["openai.Audio.transcribe"] }
    },
    {
      contractPath: "POST /v1/images/generations",
      typescript: { calleePatterns: ["openai.images.generate"] },
      python: { calleePatterns: ["openai.Image.create"] }
    },
    {
      contractPath: "POST /v1/fine_tuning/jobs",
      typescript: { calleePatterns: ["openai.fineTuning.jobs.create"] },
      python: { calleePatterns: ["openai.FineTuningJob.create"] }
    }
  ]
});
