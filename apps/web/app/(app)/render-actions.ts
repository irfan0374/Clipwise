"use server";
import { FinalError, startFinal } from "@clipwise/queue";
import { Id } from "@clipwise/shared";
import { z } from "zod";
import { ActionError, action } from "@/lib/action";

export const renderFinal = action(
  z.object({ videoId: Id, expectedVersion: z.number().int().min(1) }),
  async (input, { workspace }) => {
    try {
      return await startFinal({ ...input, workspaceId: workspace._id });
    } catch (error) {
      if (error instanceof FinalError) throw new ActionError(error.code, error.message);
      throw error;
    }
  },
);
