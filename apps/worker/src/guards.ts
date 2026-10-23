import { setProviderGuards } from "@clipwise/pipeline";
import { budgetGuards } from "@clipwise/queue";
import { jobContext, recordUsage } from "./context";

/** Budget guards for the worker: usage rows belong to the job's video (see packages/queue/src/guards.ts). */
export function installBudgetGuards() {
  setProviderGuards(
    budgetGuards(async (rows) => {
      const ctx = jobContext.getStore();
      if (ctx) await recordUsage(ctx, rows);
    }),
  );
}
