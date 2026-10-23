import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// Local dev reads the repo-root .env (shared with the worker and CLI). On Vercel, env vars come from the dashboard.
loadEnv({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

const config: NextConfig = {
  // Workspace packages ship TypeScript source, so Next compiles them.
  transpilePackages: [
    "@clipwise/shared",
    "@clipwise/db",
    "@clipwise/video",
    "@clipwise/queue",
    "@clipwise/storage",
    "@clipwise/pipeline",
  ],
  // Server-only Node libraries: load them from node_modules instead of bundling.
  serverExternalPackages: ["mongoose", "mongodb", "bullmq", "ioredis", "@google/genai", "@aws-sdk/client-s3"],
};

export default config;
