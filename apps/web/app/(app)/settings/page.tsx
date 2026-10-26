import { Formats, LengthModes, Voices } from "@clipwise/shared";
import type { Metadata } from "next";
import { type Defaults, SettingsPanel } from "@/components/settings/settings-panel";
import { requireUser } from "@/lib/session";
import { settingsUsage } from "@/lib/settings";
export const metadata: Metadata = { title: "Settings" };
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, workspace } = await requireUser();
  const query = await searchParams;
  const tab = query.tab === "account" || query.tab === "defaults" ? query.tab : "usage";
  const settings = workspace.settings;
  const defaults: Defaults = {
    name: workspace.name,
    defaultFormat: Formats.find((f) => f === settings?.defaultFormat) ?? "explainer",
    defaultLength: LengthModes.find((l) => l === settings?.defaultLength) ?? "auto",
    defaultVoiceId: Voices.find((v) => v.id === settings?.defaultVoiceId)?.id ?? Voices[0].id,
  };
  return (
    <SettingsPanel
      tab={tab}
      defaults={defaults}
      usage={await settingsUsage(user.id, workspace._id)}
      user={{ name: user.name, email: user.email }}
    />
  );
}
