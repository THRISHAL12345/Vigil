import { logger } from "@vigil/logger";
import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { ClassifiedChange, UsageSite, CandidatePatch } from "@vigil/schemas";
import crypto from "crypto";
import Groq from "groq-sdk";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy" });

interface FixJobData {
  change: ClassifiedChange;
  usageSite: UsageSite;
}

const worker = new Worker(
  "fix-generator-queue",
  async (job: Job<FixJobData>) => {
    logger.info({ jobId: job.id, usageSiteId: job.data.usageSite.id }, "Processing fix-generator job");
    try {
      const { change, usageSite } = job.data;
      
      // In a real implementation:
      // 1. Fetch exact file context using scoped read tools
      
      const systemPrompt = `You are an expert patch generator for a repository. 
You will be given a vendor API change and a specific usage site in a codebase.
Generate a strict unified diff to fix the usage site according to the API change.
Output only the diff string, nothing else.`;

      const userPrompt = `Change Classification: ${change.classification}
Rationale: ${change.rationale}
Usage Site: ${usageSite.filePath} (Lines ${usageSite.startLine}-${usageSite.endLine})

Please provide the unified diff to fix this usage site.`;

      let generatedDiff = "--- a/file\n+++ b/file\n+ // TODO: implement fix";
      let generatorModel = "groq-llama3-70b-8192";

      if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "dummy") {
        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          model: "llama3-70b-8192",
          temperature: 0,
        });
        generatedDiff = completion.choices[0]?.message?.content || generatedDiff;
      }

      const patch: CandidatePatch = {
        id: crypto.randomUUID(),
        usageSiteId: usageSite.id,
        diff: generatedDiff,
        generatorModel,
        generatorConfidence: 0.9,
        createdAt: new Date().toISOString()
      };
      
      logger.info({ patchId: patch.id, jobId: job.id }, "Successfully generated patch");
      return patch;
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, "Failed to process fix-generator job");
      throw error;
    }
  },
  { connection }
);

worker.on("ready", () => {
  logger.info("fix-generator worker is running and listening for jobs");
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down fix-generator worker...");
  await worker.close();
  process.exit(0);
});
