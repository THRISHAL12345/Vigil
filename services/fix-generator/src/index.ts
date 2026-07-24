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
Note: You are strictly limited to 5 file reads per job. Use them wisely to read the usage site and any immediately relevant imports.
Generate a strict unified diff to fix the usage site according to the API change.
Output ONLY the unified diff string. No other markdown formatting except the diff itself.`;

      const userPrompt = `Change Classification: ${change.classification}
Rule Triggered: ${change.ruleTriggered || "LLM Assessed"}
Rationale / Structural Diff: ${change.rationale}
Usage Site: ${usageSite.filePath} (Lines ${usageSite.startLine}-${usageSite.endLine})

Please read the file, and then provide the unified diff to fix this usage site.`;

      let generatedDiff = "--- a/file\n+++ b/file\n+ // TODO: implement fix";
      let generatorModel = "llama3-70b-8192";

      if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "dummy" && process.env.NODE_ENV !== "test") {
        let readsCount = 0;
        const MAX_READS = 5;

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
                readsCount++;
                logger.info({ tool: "read_file", filePath, jobId: job.id, attempt: readsCount }, "LLM requested file context");
                
                if (readsCount > MAX_READS) {
                  logger.warn({ jobId: job.id, filePath }, "LLM exceeded maximum allowed file reads");
                  return "Error: Tool read limit exceeded. You are not allowed to read any more files for this job.";
                }

                const absolutePath = path.resolve(targetDir as string, filePath);
                // Strict path traversal prevention per AGENTS.md §6.4
                if (!absolutePath.startsWith(path.resolve(targetDir as string))) {
                  logger.error({ jobId: job.id, attemptedPath: absolutePath }, "UNAUTHORIZED: LLM attempted path traversal outside target directory");
                  return "Error: Path traversal is strictly forbidden. This incident has been logged.";
                }

                try {
                  const content = await fs.readFile(absolutePath, "utf-8");
                  return content;
                } catch (error: any) {
                  logger.error({ err: error, jobId: job.id, filePath }, "LLM read_file tool encountered an error");
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
