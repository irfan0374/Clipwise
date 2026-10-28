import { privateDataCollection, scrubReport } from "@clipwise/shared";
import * as Sentry from "@sentry/node";

// Error reports for the worker (Sentry). Off unless SENTRY_DSN is set. Only the error, the job and the video id
// are sent: never scripts, topics, voices, files, keys or personal data.

export function initMonitoring() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.CLIPWISE_ENV ?? "development",
    release: process.env.CLIPWISE_RELEASE,
    dataCollection: privateDataCollection,
    tracesSampleRate: 0,
    initialScope: { tags: { app: "worker" } },
    beforeSend: (event) => scrubReport(event),
    beforeBreadcrumb: (crumb) => (crumb.category === "console" ? null : crumb), // logs mention topics
  });
  return true;
}

/** A job that failed for good (no more retries). Expected stops (budget pause, suspension) are not errors. */
export function reportJobFailure(
  error: unknown,
  job: { name: string; videoId: string; attempt: number; code: string },
) {
  if (job.code === "PAUSED" || job.code === "FORBIDDEN") return;
  Sentry.withScope((scope) => {
    scope.setTags({ job: job.name, code: job.code });
    scope.setContext("job", { videoId: job.videoId, attempt: job.attempt });
    Sentry.captureException(error);
  });
}

export const flushMonitoring = () => Sentry.flush(2000);
