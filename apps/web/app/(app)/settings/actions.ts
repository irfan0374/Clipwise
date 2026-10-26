"use server";
import { Workspace } from "@clipwise/db";
import { Format, LengthMode, VoiceId } from "@clipwise/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
export const updateSettings = action(
  z.object({
    name: z.string().trim().min(1).max(80),
    defaultFormat: Format,
    defaultLength: LengthMode,
    defaultVoiceId: VoiceId,
  }),
  async ({ name, ...settings }, { workspace }) => {
    await Workspace.updateOne({ _id: workspace._id }, { $set: { name, settings } }, { runValidators: true });
    revalidatePath("/settings");
    revalidatePath("/create");
    return { saved: true };
  },
);
