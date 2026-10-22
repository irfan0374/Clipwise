export class FatalError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const statusOf = (error: unknown): number | undefined => {
  const e = error as { status?: number; statusCode?: number };
  return e?.status ?? e?.statusCode;
};

/** Rate limits, server errors and network failures are worth retrying; everything else is not. */
export const isTransient = (error: unknown) => {
  if (error instanceof FatalError) return false;
  const status = statusOf(error);
  if (status !== undefined) {
    // A daily quota is not worth retrying within minutes.
    if (status === 429 && /PerDay|per day/i.test((error as Error).message ?? "")) return false;
    return status === 429 || status >= 500;
  }
  return error instanceof TypeError; // fetch network failure
};

export const withRetry = async <T>(
  fn: (attempt: number) => Promise<T>,
  { tries = 3, backoffMs = [5_000, 15_000, 45_000], label = "call" } = {},
): Promise<{ value: T; attempts: number }> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return { value: await fn(attempt), attempts: attempt };
    } catch (error) {
      if (attempt >= tries || !isTransient(error)) throw error;
      const wait = backoffMs[attempt - 1] ?? backoffMs.at(-1) ?? 5_000;
      console.warn(`  ${label} failed (${(error as Error).message}); retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
};
