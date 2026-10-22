export const ErrorCodes = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "LIMIT_REACHED",
  "BUSY",
  "PAUSED",
  "CONFLICT",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof ErrorCodes)[number];

/** Every server action returns this; actions never throw to the browser. `message` is always user-safe. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; retryAfter?: number } };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (code: ErrorCode, message: string, retryAfter?: number): ActionResult<never> => ({
  ok: false,
  error: retryAfter === undefined ? { code, message } : { code, message, retryAfter },
});
