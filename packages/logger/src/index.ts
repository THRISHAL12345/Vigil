import pino from "pino";

// Define redaction paths for security and privacy (AGENTS.md §8.4 and §17)
const redactPaths = [
  "*.authorization",
  "*.password",
  "*.apiKey",
  "*.secret",
  "*.token",
  "*.env.*",
  "*.githubAppPrivateKey",
  // Ensure no code contents or PII accidentally logs
  "*.codeContent",
  "*.diff",
  "*.email",
];

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  // In development, pretty print. In production, use structured JSON.
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
      },
    },
  }),
});

export type Logger = pino.Logger;
