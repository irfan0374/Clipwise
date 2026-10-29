import type { Instrumentation } from "next";

// Server error reports (Sentry). Off unless NEXT_PUBLIC_SENTRY_DSN is set (the DSN is public by design: it only
// lets an app send reports). What's sent is kept minimal: see privateDataCollection in @clipwise/shared.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { environmentProblems, privateDataCollection, scrubReport } = await import("@clipwise/shared");
  const env = process.env.NEXT_PUBLIC_CLIPWISE_ENV;
  // Same check as the worker's: with a wrong REDIS_NAMESPACE or database, videos queue up where no worker of this
  // environment looks. The site keeps running (sign-in, library), but every server start says what to fix.
  const problems = environmentProblems(env, {
    redisNamespace: process.env.REDIS_NAMESPACE,
    mongoUri: process.env.MONGODB_URI,
  });
  const problem = problems.length
    ? `settings are not set up for ${env}: ${problems.join("; ")} (see design/deploy.md)`
    : null;
  if (problem) console.error(`[web] ${problem}`);
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_CLIPWISE_ENV ?? "development",
    dataCollection: privateDataCollection,
    tracesSampleRate: 0,
    initialScope: { tags: { app: "web" } },
    beforeSend: (event) => scrubReport(event),
    beforeBreadcrumb: (crumb) => (crumb.category === "console" ? null : crumb),
  });
  if (problem) Sentry.captureMessage(problem, "error");
}

/** Errors in pages, server actions and API routes. */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
