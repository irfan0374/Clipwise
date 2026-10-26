import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { assertWorkspaceActive, connectDb, UsageEvent } from "@clipwise/db";
import { BudgetExceededError, setProviderGuards } from "@clipwise/pipeline/web";
import { isGenerationPaused, reserveGeminiRequest } from "@clipwise/queue";

// The web app calls Gemini directly only for idea suggestions. Like the worker, it reserves each request
// against the global daily budget first and records it as a usage row.
type Who = { workspaceId: string; userId: string };
const who = new AsyncLocalStorage<Who>();
const cache = globalThis as typeof globalThis & { __clipwiseGuards?: boolean };

if (!cache.__clipwiseGuards) {
  cache.__clipwiseGuards = true;
  setProviderGuards({
    beforeGeminiRequest: async () => {
      const current = who.getStore();
      if (current) await assertWorkspaceActive(current.workspaceId);
      if (await isGenerationPaused("ai")) throw new BudgetExceededError("Generation paused");
      if (!(await reserveGeminiRequest())) throw new BudgetExceededError("Gemini daily request budget used up");
      const w = who.getStore();
      if (w) {
        await connectDb();
        await UsageEvent.create({ ...w, provider: "gemini", operation: "request", quantity: 1, unit: "requests" });
      }
    },
  });
}

/** Runs a Gemini-using function on behalf of a workspace (for budget accounting). */
export const asWorkspace = <T>(w: Who, fn: () => Promise<T>) => who.run(w, fn);
