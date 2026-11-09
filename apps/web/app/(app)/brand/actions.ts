"use server";
import { randomBytes } from "node:crypto";
import { Workspace } from "@clipwise/db";
import { VoiceId } from "@clipwise/shared";
import { keys, storage } from "@clipwise/storage";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, action } from "@/lib/action";
import { BrandKitForm, checkLogo, LOGO_MAX_BYTES } from "@/lib/brand-kit";

/** Stores a logo file and returns its key; it becomes the Brand kit's logo when the kit is saved. */
export const uploadBrandLogo = action(z.instanceof(FormData), async (form, { workspace }) => {
  const file = form.get("logo");
  if (!(file instanceof File) || !file.size) throw new ActionError("VALIDATION", "Choose a logo file.");
  if (file.size > LOGO_MAX_BYTES) throw new ActionError("VALIDATION", "The logo is larger than 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkLogo(bytes);
  if ("error" in checked) throw new ActionError("VALIDATION", checked.error);
  const key = keys.brandLogo(workspace._id.toString(), randomBytes(8).toString("hex"), checked.ext);
  const store = storage();
  await store.put(key, Buffer.from(bytes), {
    contentType: checked.ext === "svg" ? "image/svg+xml" : `image/${checked.ext}`,
  });
  return {
    key,
    name: file.name.slice(0, 120) || `logo.${checked.ext}`,
    bytes: file.size,
    url: await store.signedUrl(key),
  };
});

/** Saves the Brand kit (and the default voice it shares with Settings → Defaults). New videos use it. */
export const saveBrandKit = action(
  BrandKitForm.extend({ voiceId: VoiceId }),
  async ({ voiceId, logo, ...kit }, { workspace }) => {
    if (logo) {
      // Only a logo uploaded to this workspace, still in storage.
      if (!logo.key.startsWith(`ws/${workspace._id}/brand/logo-`) || !(await storage().exists(logo.key)))
        throw new ActionError("VALIDATION", "Upload the logo again.");
    }
    await Workspace.updateOne(
      { _id: workspace._id },
      {
        $set: {
          brandKit: {
            ...kit,
            logoKey: logo?.key ?? null,
            logoName: logo?.name ?? null,
            logoBytes: logo?.bytes ?? null,
          },
          "settings.defaultVoiceId": voiceId,
        },
      },
      { runValidators: true },
    );
    revalidatePath("/brand");
    revalidatePath("/settings");
    revalidatePath("/create");
    return { saved: true };
  },
);
