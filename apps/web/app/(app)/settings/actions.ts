"use server";
import { SocialAccount, Workspace } from "@clipwise/db";
import { Format, Id, LengthMode, VoiceId } from "@clipwise/shared";
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

/** Forgets a connected Instagram account and its access key. Scheduled posts for it come in Step J2. */
export const disconnectSocialAccount = action(z.object({ accountId: Id }), async ({ accountId }, { workspace }) => {
  await SocialAccount.deleteOne({ _id: accountId, workspaceId: workspace._id });
  revalidatePath("/settings");
  return { disconnected: true };
});
