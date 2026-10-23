"use client";

import { type Format, Formats, type LengthMode, type VoiceId, Voices } from "@clipwise/shared";
import { Lightbulb, Loader2, Pause, Play, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { brainstormIdeas, createVideo } from "@/app/(app)/actions";
import { ChipGroup } from "@/components/app/chip-group";
import { USAGE_CHANGED } from "@/components/app/live-usage-meter";
import { Segmented } from "@/components/app/segmented";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MAX_TOPIC = 300;
const formatLabels: Record<Format, string> = {
  promo: "Promo",
  explainer: "Explainer",
  story: "Story",
  tips: "Tips",
  recap: "Recap",
  quote: "Quote",
};
const placeholders: Record<Format, string> = {
  promo: "Launch video for our new running shoes",
  explainer: "How does GPS know where you are?",
  story: "The night the power went out across the whole city",
  tips: "3 habits that help you fall asleep faster",
  recap: "The biggest space news this month",
  quote: "Small steps every day beat big plans you never start",
};
const lengthOptions = [
  { value: "30", label: "30s" },
  { value: "60", label: "60s" },
  { value: "auto", label: "Auto" },
] as const;

type Idea = { title: string; hook: string; suggestedLength: "30" | "60" };

export function CreateStudio({ defaults }: { defaults: { format: Format; lengthMode: LengthMode; voiceId: VoiceId } }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<Format>(defaults.format);
  const [length, setLength] = useState<LengthMode>(defaults.lengthMode);
  const [voiceId, setVoiceId] = useState<VoiceId>(defaults.voiceId);
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const topicRef = useRef<HTMLTextAreaElement>(null);

  // Voice sample playback (ElevenLabs' free preview clip)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const toggleSample = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(`/api/voices/${voiceId}/sample`);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    setPlaying(true);
    void audio.play().catch(() => setPlaying(false));
  };

  // Idea suggestions
  const [niche, setNiche] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [suggesting, startSuggest] = useTransition();

  const submit = () => {
    setError(null);
    startCreate(async () => {
      const res = await createVideo({ topic, format, lengthMode: length, voiceId });
      if (res.ok) {
        window.dispatchEvent(new Event(USAGE_CHANGED));
        router.push(`/videos/${res.data.videoId}`);
      } else setError(res.error.message);
    });
  };

  const suggest = () => {
    setIdeasError(null);
    startSuggest(async () => {
      const res = await brainstormIdeas({ niche, format });
      if (res.ok) setIdeas(res.data.ideas);
      else setIdeasError(res.error.message);
    });
  };

  const applyIdea = (idea: Idea) => {
    setTopic(idea.title.slice(0, MAX_TOPIC));
    setLength(idea.suggestedLength);
    topicRef.current?.focus();
    topicRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const tooShort = topic.trim().length < 3;

  return (
    <div className="space-y-10">
      <section className="space-y-5 rounded-2xl border border-line bg-panel p-5 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="topic" className="sr-only">
            Your idea
          </Label>
          <Textarea
            id="topic"
            ref={topicRef}
            value={topic}
            onChange={(e) => setTopic(e.target.value.slice(0, MAX_TOPIC))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !tooShort && !creating) submit();
            }}
            rows={4}
            placeholder={placeholders[format]}
            className="min-h-32 resize-none border-0 bg-transparent px-1 text-[17px] leading-relaxed shadow-none focus-visible:ring-0"
          />
          <p className="text-right text-label text-ink-3 tabular-nums">
            {topic.length} / {MAX_TOPIC}
          </p>
        </div>

        <div className="space-y-4 border-t border-line pt-5">
          <div className="space-y-2">
            <p className="text-label font-medium text-ink-2">Format</p>
            <ChipGroup
              label="Format"
              options={Formats.map((f) => ({ value: f, label: formatLabels[f] }))}
              value={format}
              onChange={setFormat}
            />
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="space-y-2">
              <p className="text-label font-medium text-ink-2">Length</p>
              <Segmented label="Length" options={[...lengthOptions]} value={length} onChange={setLength} />
            </div>
            <div className="space-y-2">
              <p className="text-label font-medium text-ink-2">Voice</p>
              <div className="flex items-center gap-2">
                <Select
                  value={voiceId}
                  onValueChange={(v) => {
                    audioRef.current?.pause();
                    setPlaying(false);
                    setVoiceId(v as VoiceId);
                  }}
                >
                  <SelectTrigger className="w-36" aria-label="Voice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Voices.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={toggleSample}
                  aria-label={playing ? "Stop voice sample" : "Play voice sample"}
                >
                  {playing ? <Pause /> : <Play />}
                </Button>
              </div>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1.5">
              <Button size="lg" onClick={submit} disabled={tooShort || creating}>
                {creating ? <Loader2 className="animate-spin" /> : <Sparkles />} Write my video
              </Button>
            </div>
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-red-soft px-3 py-2 text-small text-red-ink">
              {error}
            </p>
          ) : (
            <p className="text-small text-ink-3">Preview is free. A voice is only recorded when you render.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-h3">
          <Lightbulb className="size-4.5 text-ink-2" strokeWidth={1.5} /> Need an idea?
        </h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (niche.trim().length >= 2 && !suggesting) suggest();
          }}
        >
          <Input
            value={niche}
            onChange={(e) => setNiche(e.target.value.slice(0, 120))}
            placeholder="Your niche, e.g. fitness, AI, cooking"
            aria-label="Your niche"
          />
          <Button type="submit" variant="secondary" disabled={niche.trim().length < 2 || suggesting}>
            {suggesting && <Loader2 className="animate-spin" />} Suggest ideas
          </Button>
        </form>
        {ideasError && (
          <p role="alert" className="text-small text-red-ink">
            {ideasError}
          </p>
        )}
        {ideas.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {ideas.map((idea) => (
              <li key={idea.title} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-small font-medium text-ink">{idea.title}</span>
                  {idea.hook && <span className="block text-label text-ink-3">“{idea.hook}”</span>}
                </span>
                <Badge variant="outline">{idea.suggestedLength}s</Badge>
                <Button variant="ghost" size="sm" onClick={() => applyIdea(idea)}>
                  Use
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
