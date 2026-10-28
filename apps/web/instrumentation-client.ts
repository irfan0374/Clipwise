import { privateDataCollection, scrubReport } from "@clipwise/shared";
import * as Sentry from "@sentry/nextjs";

// Browser error reports (Sentry). Off unless NEXT_PUBLIC_SENTRY_DSN is set. No session replay, no tracing, no
// console logs (they can mention topics), no user details.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  try {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_CLIPWISE_ENV ?? "development",
      dataCollection: privateDataCollection,
      tracesSampleRate: 0,
      initialScope: { tags: { app: "browser" } },
      beforeSend: (event) => scrubReport(event),
      beforeBreadcrumb: (crumb) => (crumb.category === "console" ? null : crumb),
    });
  } catch {}
}
