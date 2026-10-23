import { BudgetExceededError, FatalError, ScriptFailedError } from "@clipwise/pipeline";
import type { ErrorCode } from "@clipwise/shared";
import { UnrecoverableError } from "bullmq";

/** A failure with a user-safe message. `retry: false` stops BullMQ from trying again. */
export class JobError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly userMessage: string,
    readonly retry: boolean,
    readonly detail?: string,
  ) {
    super(detail ?? userMessage);
  }
}

export const budgetPaused = (detail: string) =>
  new JobError("PAUSED", "Generation is paused for a moment. Try again later.", false, detail);

/** Maps any error to { code, user-safe message, retry? }. Full details only go to logs and the run report. */
export function classify(error: unknown): JobError {
  if (error instanceof JobError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof BudgetExceededError) return budgetPaused(message);
  if (error instanceof ScriptFailedError) {
    return new JobError(
      "INTERNAL",
      "We couldn't write a script for this topic. Try again or rephrase it.",
      false,
      message,
    );
  }
  if (/quota|RESOURCE_EXHAUSTED|out of credits/i.test(message)) {
    return new JobError("PAUSED", "Generation is paused for a moment. Try again later.", false, message);
  }
  if (error instanceof FatalError || error instanceof UnrecoverableError) {
    return new JobError("INTERNAL", "Something went wrong. Try again.", false, message);
  }
  return new JobError("INTERNAL", "Something went wrong. Try again.", true, message);
}
