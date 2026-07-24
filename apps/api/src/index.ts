import Fastify from "fastify";
import cors from "@fastify/cors";
import { logger } from "@vigil/logger";
import { prisma } from "@vigil/database";

const fastify = Fastify({
  logger: false // we will use our custom logger middleware if needed
});

fastify.register(cors, {
  origin: "*"
});

fastify.get("/health", async (request, reply) => {
  return { status: "ok", service: "vigil-api" };
});

fastify.get("/api/v1/feed", async (request, reply) => {
  try {
    const changes = await prisma.classifiedChange.findMany({
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return { changes };
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch feed");
    return reply.status(500).send({ error: "Internal Server Error" });
  }
});

fastify.get("/api/v1/installations/:id/reports", async (request: any, reply) => {
  const { id } = request.params;
  try {
    const installation = await prisma.installation.findFirst({
      where: { installationId: id },
      include: {
        usageSites: {
          include: {
            change: true,
            patches: true
          }
        }
      }
    });
    
    if (!installation) {
      return reply.status(404).send({ error: "Installation not found" });
    }
    
    return { installation };
  } catch (error) {
    logger.error({ err: error, installationId: id }, "Failed to fetch reports");
    return reply.status(500).send({ error: "Internal Server Error" });
  }
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
