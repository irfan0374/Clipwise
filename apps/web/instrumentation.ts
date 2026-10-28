import type { Instrumentation } from "next";

// Server error reports (Sentry). Off unless NEXT_PUBLIC_SENTRY_DSN is set (the DSN is public by design: it only
// lets an app send reports). What's sent is kept minimal: see privateDataCollection in @clipwise/shared.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  const { privateDataCollection, scrubReport } = await import("@clipwise/shared");
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_CLIPWISE_ENV ?? "development",
    dataCollection: privateDataCollection,
    tracesSampleRate: 0,
    initialScope: { tags: { app: "web" } },
    beforeSend: (event) => scrubReport(event),
    beforeBreadcrumb: (crumb) => (crumb.category === "console" ? null : crumb),
  });
}

/** Errors in pages, server actions and API routes. */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
