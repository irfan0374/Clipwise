import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// Local dev reads the repo-root .env (shared with the worker and CLI). On Vercel, env vars come from the dashboard.
loadEnv({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

// Safe defaults for every response. The CSP only blocks framing, plugins and foreign form targets; it doesn't
// restrict scripts or styles (GSAP and Remotion set inline styles), so it can't break the app.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const config: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
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
