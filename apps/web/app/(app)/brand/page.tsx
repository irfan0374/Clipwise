import { Voices } from "@clipwise/shared";
import { storage } from "@clipwise/storage";
import type { Metadata } from "next";
import { BrandKit } from "@/components/brand/brand-kit";
import { type BrandKitForm, defaultBrandKit } from "@/lib/brand-kit";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Brand kit" };

export default async function BrandPage() {
  const { workspace } = await requireUser();
  const kit = workspace.brandKit;
  const saved: BrandKitForm = kit
    ? {
        accent: kit.accent,
        base: kit.base,
        font: kit.font,
        casing: kit.casing,
        captionStyle: kit.captionStyle,
        showLogo: kit.showLogo ?? true,
        logoCorner: kit.logoCorner,
        cta: kit.cta ?? "",
        logo: kit.logoKey ? { key: kit.logoKey, name: kit.logoName ?? "logo", bytes: kit.logoBytes ?? 0 } : null,
      }
    : defaultBrandKit;
  const voiceId = Voices.find((v) => v.id === workspace.settings?.defaultVoiceId)?.id ?? Voices[0].id;
  return (
    <BrandKit saved={saved} voiceId={voiceId} logoUrl={kit?.logoKey ? await storage().signedUrl(kit.logoKey) : null} />
  );
}
