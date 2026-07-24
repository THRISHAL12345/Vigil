import Fastify from "fastify";
import { logger } from "@vigil/logger";

const fastify = Fastify({
  logger: false // we will use our custom logger middleware if needed
});

fastify.get("/health", async (request, reply) => {
  return { status: "ok", service: "vigil-api" };
});

fastify.get("/api/v1/feed", async (request, reply) => {
  // In a real implementation: fetch latest vendor changes from DB
  return {
    changes: [
      {
        id: "mock-change",
        vendor: "stripe",
        classification: "breaking",
        path: "POST /v1/charges body.customer_id",
        detectedAt: new Date().toISOString()
      }
    ]
  };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "3000", 10);
    await fastify.listen({ port, host: "0.0.0.0" });
    logger.info({ port }, "Vigil API listening");
  } catch (err) {
    logger.error({ err }, "Failed to start Vigil API");
    process.exit(1);
  }
};

start();
