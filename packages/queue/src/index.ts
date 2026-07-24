import { Queue, Worker, Job, Processor } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "@vigil/logger";

const getRedisConnection = () => {
  return new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
};

export const createQueue = <T>(queueName: string) => {
  return new Queue<T>(queueName, {
    connection: getRedisConnection(),
  });
};

export const createWorker = <T>(
  queueName: string,
  processor: Processor<T, any, string>
) => {
  const worker = new Worker<T, any, string>(queueName, processor, {
    connection: getRedisConnection(),
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, queue: queueName, err }, "Job failed");
  });

  worker.on("error", (err) => {
    logger.error({ queue: queueName, err }, "Worker error");
  });

  return worker;
};

// Re-export Job so consumers don't need direct bullmq dependency
export { Job };
