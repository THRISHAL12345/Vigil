import { logger } from "@vigil/logger";
import { createWorker, createQueue, Job } from "@vigil/queue";
import { ClassifiedChange, UsageSite, CandidatePatch } from "@vigil/schemas";
import { prisma } from "@vigil/database";
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
  usageSiteId: string;
}

const worker = createWorker<FixJobData>(
  "fix-generator-queue",
  async (job: Job<FixJobData>) => {
    logger.info({ jobId: job.id, usageSiteId: job.data.usageSiteId }, "Processing fix-generator job");
    try {
      const { usageSiteId } = job.data;
      
      const usageSiteDb = await prisma.usageSite.findUnique({
        where: { id: usageSiteId },
        include: { change: true, installation: true }
      });

      if (!usageSiteDb || !usageSiteDb.change || !usageSiteDb.installation) {
        throw new Error("Could not find usageSite, change, or installation in database");
      }
      
      const usageSite = usageSiteDb as unknown as UsageSite;
      const change = usageSiteDb.change as unknown as ClassifiedChange;

      let targetDir = process.env.VIGIL_TARGET_REPO_DIR;
      if (!targetDir) {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        targetDir = path.resolve(__dirname, "../../../fixtures/demo-corpus", usageSiteDb.installation.repoFullName.replace("/", "-"));
      }
      
      const systemPrompt = `You are an expert patch generator for a repository. 
You will be given a vendor API change and a specific usage site in a codebase.
You can use the 'read_file' tool to fetch the exact file context from the repository. You MUST read the file containing the usage site before attempting to generate a patch.
Note: You are strictly limited to 5 file reads per job. Use them wisely to read the usage site and any immediately relevant imports.
When you are ready to propose a fix, you MUST use the 'write_patch' tool to submit your unified diff and a confidence score.
If you are unable to generate a safe fix, do not call 'write_patch'.`;

      const userPrompt = `Change Classification: ${change.classification}
Rule Triggered: ${change.ruleTriggered || "LLM Assessed"}
Rationale / Structural Diff: ${change.rationale}
Usage Site: ${usageSite.filePath} (Lines ${usageSite.startLine}-${usageSite.endLine})

Please read the file, and then provide the unified diff to fix this usage site.`;

      let generatedDiff: string | null = "--- a/file\n+++ b/file\n+ // TODO: implement fix";
      let generatorModel = "llama3-70b-8192";
      let generatorConfidence = 0.9;

      if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "dummy" && process.env.NODE_ENV !== "test") {
        let readsCount = 0;
        const MAX_READS = 5;

        const { toolCalls } = await generateText({
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
            }),
            write_patch: tool({
              description: "Proposes a CandidatePatch. Call this when you are confident in your fix.",
              inputSchema: z.object({
                diff: z.string().describe("The unified diff string to fix the usage site"),
                confidence: z.number().min(0).max(1).describe("Your confidence in this patch being correct (0.0 to 1.0)")
              }),
              execute: async (args) => {
                logger.info({ jobId: job.id, confidence: args.confidence }, "LLM called write_patch tool");
                return args;
              }
            })
          }
        });
        
        const patchCall = toolCalls.find((c: any) => c.toolName === "write_patch");
        if (patchCall) {
          generatedDiff = (patchCall as any).args.diff;
          generatorConfidence = (patchCall as any).args.confidence;
        } else {
          logger.warn({ jobId: job.id }, "LLM failed to call write_patch tool");
          generatedDiff = null;
        }
      }

      if (!generatedDiff || generatorConfidence < 0.8) {
        logger.warn({ jobId: job.id, confidence: generatorConfidence }, "Agent could not produce a high-confidence patch. Flagging for read-only report.");
        return null as any; // Return null (or handle according to queue expectations) to skip creating a bad patch
      }

      const patchId = crypto.randomUUID();
      
      const savedPatch = await prisma.candidatePatch.create({
        data: {
          id: patchId,
          usageSiteId: usageSite.id,
          diff: generatedDiff,
          generatorModel,
          generatorConfidence,
          verified: false
        }
      });
      
      const sandboxVerifierQueue = createQueue<any>("sandbox-verifier-queue");
      await sandboxVerifierQueue.add("verify-sandbox", {
        patchId: patchId
      });

      logger.info({ patchId, jobId: job.id }, "Successfully generated patch and enqueued verification");
      return savedPatch;
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
