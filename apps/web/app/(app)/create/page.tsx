import { type Format, Formats, type LengthMode, LengthModes, type VoiceId, Voices } from "@clipwise/shared";
import type { Metadata } from "next";
import { CreateStudio } from "@/components/video/create-studio";
import { RecentStrip } from "@/components/video/recent-strip";
import { requireUser } from "@/lib/session";
import { recentVideos } from "@/lib/videos";

export const metadata: Metadata = { title: "Create" };

export default async function CreatePage() {
  const { workspace } = await requireUser();
  const recent = await recentVideos(workspace._id, 3);
  const s = workspace.settings;
  const defaults = {
    format: (Formats.includes(s?.defaultFormat as Format) ? s?.defaultFormat : "explainer") as Format,
    lengthMode: (LengthModes.includes(s?.defaultLength as LengthMode) ? s?.defaultLength : "auto") as LengthMode,
    voiceId: (Voices.some((v) => v.id === s?.defaultVoiceId) ? s?.defaultVoiceId : Voices[0].id) as VoiceId,
  };
  return (
    <div className="mx-auto max-w-[760px] space-y-10">
      <header className="space-y-2">
        <h1 className="text-h1 sm:text-[36px]">What do you want to make?</h1>
        <p className="text-ink-2">Describe an idea. Clipwise writes, checks, voices and animates it.</p>
      </header>
      <CreateStudio defaults={defaults} />
      <RecentStrip videos={recent} />
    </div>
  );
}
