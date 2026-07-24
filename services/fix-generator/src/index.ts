import { logger } from "@vigil/logger";
import { createWorker, Job } from "@vigil/queue";
import { ClassifiedChange, UsageSite, CandidatePatch } from "@vigil/schemas";
import crypto from "crypto";
import { generateText, tool } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || "dummy",
});

interface FixJobData {
  change: ClassifiedChange;
  usageSite: UsageSite;
}

const worker = createWorker<FixJobData>(
  "fix-generator-queue",
  async (job: Job<FixJobData>) => {
    logger.info({ jobId: job.id, usageSiteId: job.data.usageSite.id }, "Processing fix-generator job");
    try {
      const { change, usageSite } = job.data;
      
      let targetDir = process.env.VIGIL_TARGET_REPO_DIR;
      if (!targetDir) {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        targetDir = path.resolve(__dirname, "../../../fixtures/demo-corpus/test-user-test-repo");
      }
      
      const systemPrompt = `You are an expert patch generator for a repository. 
You will be given a vendor API change and a specific usage site in a codebase.
You can use the 'read_file' tool to fetch the exact file context from the repository. You MUST read the file containing the usage site before attempting to generate a patch.
Generate a strict unified diff to fix the usage site according to the API change.
Output ONLY the unified diff string. No other markdown formatting except the diff itself.`;

      const userPrompt = `Change Classification: ${change.classification}
Rationale: ${change.rationale}
Usage Site: ${usageSite.filePath} (Lines ${usageSite.startLine}-${usageSite.endLine})

Please read the file, and then provide the unified diff to fix this usage site.`;

      let generatedDiff = "--- a/file\n+++ b/file\n+ // TODO: implement fix";
      let generatorModel = "llama3-70b-8192";

      if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "dummy" && process.env.NODE_ENV !== "test") {
        const { text } = await generateText({
          model: groq("llama3-70b-8192"),
          system: systemPrompt,
          prompt: userPrompt,
          tools: {
            read_file: tool({
              description: "Reads the content of a file from the repository.",
              inputSchema: z.object({
                filePath: z.string().describe("The relative path of the file to read (e.g. src/index.ts)"),
              }),
              execute: async ({ filePath }) => {
                logger.info({ tool: "read_file", filePath, jobId: job.id }, "LLM requested file context");
                const absolutePath = path.resolve(targetDir as string, filePath);
                // Basic path traversal prevention
                if (!absolutePath.startsWith(path.resolve(targetDir as string))) {
                  return "Error: Path traversal is not allowed.";
                }
                try {
                  const content = await fs.readFile(absolutePath, "utf-8");
                  return content;
                } catch (error: any) {
                  return `Error reading file: ${error.message}`;
                }
              }
            })
          }
        });
        generatedDiff = text;
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
  }
);

worker.on("ready", () => {
  logger.info("fix-generator worker is running and listening for jobs");
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down fix-generator worker...");
  await worker.close();
  process.exit(0);
});
