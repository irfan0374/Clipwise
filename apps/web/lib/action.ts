import "server-only";
import { WorkspaceAccessError } from "@clipwise/db";
import { FinalError } from "@clipwise/queue";
import { type ActionResult, type ErrorCode, fail, ok } from "@clipwise/shared";
import type { z } from "zod";
import { requireUser } from "./session";

/** Thrown inside a handler to return a specific, user-safe error. */
export class ActionError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export const assertAdmin = (ctx: { user: { role?: string } }) => {
  if (ctx.user.role !== "admin") throw new ActionError("FORBIDDEN", "Administrator access required.");
};

const messages: Partial<Record<ErrorCode, string>> = {
  NOT_FOUND: "This video doesn't exist anymore.",
  FORBIDDEN: "You don't have access to this.",
  INTERNAL: "Something went wrong. Try again.",
};

type Ctx = Awaited<ReturnType<typeof requireUser>>;

/**
 * Every server action is built with this: sign-in check, input validation, then the handler; errors become a
 * user-safe ActionResult (never a thrown error in the browser). workspaceId always comes from the session.
 */
export const action =
  <I extends z.ZodType, O>(input: I, handler: (data: z.infer<I>, ctx: Ctx) => Promise<O>) =>
  async (raw: z.input<I>): Promise<ActionResult<O>> => {
    const ctx = await requireUser();
    const parsed = input.safeParse(raw);
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Please check the form.");
    try {
      return ok(await handler(parsed.data, ctx));
    } catch (error) {
      if (error instanceof WorkspaceAccessError) return fail("FORBIDDEN", "This workspace is suspended.");
      if (error instanceof FinalError) return fail(error.code, error.message);
      if (error instanceof ActionError) return fail(error.code, error.message, error.retryAfter);
      console.error("[action]", error);
      return fail("INTERNAL", messages.INTERNAL ?? "Something went wrong.");
    }
  };
