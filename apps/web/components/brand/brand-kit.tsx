"use client";
import { Voices } from "@clipwise/shared";
import { CaptionStyles, LogoCorners, TitleCasings } from "@clipwise/video";
import { brandSampleTimeline } from "@clipwise/video/brand-sample";
import { Player } from "@remotion/player";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  Link2,
  Loader2,
  Pause,
  Pipette,
  Play,
  Upload,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveBrandKit, uploadBrandLogo } from "@/app/(app)/brand/actions";
import { Composition } from "@/components/video/studio-shared";
import {
  type BrandKitForm,
  CTA_MAX,
  checkLogo,
  cornerNames,
  defaultBrandKit,
  fontInfo,
  Hex,
  presets,
} from "@/lib/brand-kit";
import { cn } from "@/lib/utils";

// Brand kit, from the Stitch "Brand Kit" screen: one card of settings on the left, a live 9:16 preview on the
// right (on phones above), and a Save bar docked at the bottom. Saved kits apply to videos created afterwards.

type VoiceIdValue = (typeof Voices)[number]["id"];
const voiceInfo: Record<string, { label: string; kind: string }> = {
  Liam: { label: "Liam (US)", kind: "Energetic & Confident" },
  Jessica: { label: "Jessica (US)", kind: "Bright & Warm" },
  George: { label: "George (UK)", kind: "Warm Storyteller" },
};
const casingNames = { upper: "Uppercase", title: "Title Case", sentence: "Sentence case" } as const;
const captionNames = { outline: "Bold outline", pill: "Pill badge", minimal: "Minimal" } as const;

const section = "p-5 sm:p-6";
const selected = "border-2 border-ink shadow-2xs";
const unselected = "border border-line hover:border-ink-3";
const kb = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function SectionHead({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-[13px] text-ink-3">{text}</p>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper/60 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label={`Pick ${label}`}
          onClick={() => picker.current?.click()}
          className="size-8 shrink-0 rounded-lg border border-black/10 shadow-inner"
          style={{ backgroundColor: value }}
        />
        <label className="flex min-w-0 flex-col">
          <span className="text-[11px] font-semibold tracking-wide text-ink-3">{label}</span>
          <input
            value={text}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              const next = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
              setText(next.toUpperCase());
              if (Hex.safeParse(next).success) onChange(next.toUpperCase());
            }}
            onBlur={() => setText(value)}
            className="w-24 bg-transparent font-mono text-sm font-medium uppercase outline-none"
          />
        </label>
      </div>
      <button
        type="button"
        aria-label={`Choose ${label} color`}
        onClick={() => picker.current?.click()}
        className="rounded-md p-1 text-ink-3 hover:bg-wash hover:text-ink"
      >
        <Pipette className="size-4" />
      </button>
      <input
        ref={picker}
        type="color"
        tabIndex={-1}
        aria-hidden="true"
        value={value.toLowerCase()}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="sr-only"
      />
    </div>
  );
}

function CaptionSample({ style, accent }: { style: BrandKitForm["captionStyle"]; accent: string }) {
  if (style === "pill")
    return (
      <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
        Speed{" "}
        <span className="rounded px-1" style={{ backgroundColor: accent, color: "#fff" }}>
          forward
        </span>
      </span>
    );
  if (style === "minimal")
    return (
      <span className="text-xs text-white drop-shadow">
        speed{" "}
        <span className="font-semibold" style={{ color: accent }}>
          forward
        </span>
      </span>
    );
  return (
    <span className="text-xs font-bold tracking-wide text-white">
      SPEED{" "}
      <span className="underline decoration-2" style={{ color: accent }}>
        FORWARD
      </span>
    </span>
  );
}

export function BrandKit({
  saved,
  voiceId: savedVoice,
  logoUrl,
}: {
  saved: BrandKitForm;
  voiceId: VoiceIdValue;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState(saved);
  const [voiceId, setVoiceId] = useState(savedVoice);
  const [logoSrc, setLogoSrc] = useState(logoUrl);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saving, startSave] = useTransition();
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof BrandKitForm>(key: K, value: BrandKitForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const dirty = !same(form, saved) || voiceId !== savedVoice;

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => () => audio.current?.pause(), []);

  const timeline = useMemo(
    () =>
      brandSampleTimeline(
        {
          accent: form.accent,
          base: form.base,
          font: form.font,
          casing: form.casing,
          captionStyle: form.captionStyle,
          logo: form.showLogo && form.logo && logoSrc ? { src: logoSrc, corner: form.logoCorner } : null,
        },
        form.cta,
      ),
    [form, logoSrc],
  );

  const upload = async (file: File | undefined) => {
    if (!file) return;
    // Quick check here for a clear message; the server checks again.
    const problem = checkLogo(new Uint8Array(await file.slice(0, Math.min(file.size, 64 * 1024)).arrayBuffer()));
    if (file.size > 2 * 1024 * 1024) return toast.error("The logo is larger than 2 MB.");
    if ("error" in problem && !/scripts or links/.test(problem.error)) return toast.error(problem.error);
    setUploading(true);
    try {
      const data = new FormData();
      data.set("logo", file);
      const res = await uploadBrandLogo(data);
      if (!res.ok) toast.error(res.error.message);
      else {
        setForm((f) => ({ ...f, logo: { key: res.data.key, name: res.data.name, bytes: res.data.bytes } }));
        setLogoSrc(res.data.url);
      }
    } catch {
      toast.error("Couldn't upload the logo. Try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  // ElevenLabs' free sample clip, through the same route the Create page uses.
  const playVoice = (id: string) => {
    audio.current?.pause();
    if (playingVoice === id) return setPlayingVoice(null);
    const a = new Audio(`/api/voices/${id}/sample`);
    a.onended = () => setPlayingVoice(null);
    audio.current = a;
    a.play().then(
      () => setPlayingVoice(id),
      () => toast.error("Couldn't play the sample."),
    );
  };

  const save = () =>
    startSave(async () => {
      try {
        const res = await saveBrandKit({ ...form, voiceId });
        if (!res.ok) toast.error(res.error.message);
        else {
          toast.success("Brand kit saved. New videos will use it.");
          router.refresh();
        }
      } catch {
        toast.error("Couldn't save the brand kit. Try again.");
      }
    });

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1">Brand kit</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-2">
            Set your visual identity once. Clipwise applies your colors, typography, logo and call-to-action to every
            new video.
          </p>
        </div>
        <span
          className={cn(
            "flex items-center gap-2 rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] font-semibold",
            dirty ? "text-amber-ink" : "text-ink",
          )}
        >
          <span className={cn("size-2 rounded-full", dirty ? "bg-amber" : "animate-pulse bg-teal")} />
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        {/* Live preview: right column on computers, first on phones. */}
        <div className="flex flex-col items-center lg:sticky lg:top-8 lg:order-2 lg:col-span-5">
          <div className="flex w-full max-w-[190px] flex-col gap-3 sm:max-w-[300px] lg:max-w-[340px]">
            <div className="flex items-center justify-between px-1">
              <span className="font-heading text-sm font-semibold whitespace-nowrap">Live preview</span>
              <span className="flex items-center gap-1.5 rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-semibold text-teal-ink">
                <span className="size-1.5 rounded-full bg-teal" />
                {dirty ? "Preview" : "Synchronized"}
              </span>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-[#27272A] bg-[#0B0B0F] shadow-xl">
              <Player
                component={Composition}
                inputProps={timeline as unknown as Record<string, unknown>}
                durationInFrames={timeline.durationInFrames}
                fps={30}
                compositionWidth={1080}
                compositionHeight={1920}
                autoPlay
                loop
                controls
                acknowledgeRemotionLicense
                style={{ width: "100%", aspectRatio: "9 / 16" }}
              />
            </div>
            <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-ink-3">
              <Info className="mt-0.5 size-4 shrink-0" />
              Applies to new videos. Existing videos in your library keep their look.
            </p>
          </div>
        </div>

        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel shadow-2xs lg:order-1 lg:col-span-7">
          {/* 1. Logo */}
          <section className={section}>
            <SectionHead title="Brand logo" text="Displayed in the corner of your videos" />
            <div className="space-y-4">
              {form.logo && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper/60 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-[#313030] p-1">
                      {logoSrc ? (
                        // biome-ignore lint/performance/noImgElement: short-lived signed link, not cacheable
                        <img src={logoSrc} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <Zap className="size-5 text-white" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{form.logo.name}</span>
                      {form.logo.bytes > 0 && <span className="text-[11px] text-ink-3">{kb(form.logo.bytes)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInput.current?.click()}
                      className="rounded-lg border border-line bg-panel px-3 py-1.5 text-[13px] font-medium hover:bg-wash"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        set("logo", null);
                        setLogoSrc(null);
                      }}
                      className="rounded-lg px-2.5 py-1.5 text-[13px] text-red-ink hover:bg-red-soft/50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void upload(e.dataTransfer.files[0]);
                }}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-[13px] text-ink-3 transition-colors",
                  dragging ? "border-teal bg-teal-soft/40" : "border-line bg-paper/30 hover:border-teal",
                )}
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading ? "Uploading…" : "Drop PNG, SVG or WebP up to 2 MB, or click to choose"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => void upload(e.target.files?.[0])}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex cursor-pointer items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.showLogo}
                    onClick={() => set("showLogo", !form.showLogo)}
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                      form.showLogo ? "bg-teal-ink" : "bg-line",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform",
                        form.showLogo && "translate-x-4",
                      )}
                    />
                  </button>
                  <span className="text-sm">Show logo in the corner</span>
                </label>
                <label className="relative inline-flex items-center gap-1.5 rounded-lg border border-line bg-wash px-3 py-1 text-xs font-medium">
                  <span className="sr-only">Logo corner</span>
                  <select
                    value={form.logoCorner}
                    onChange={(e) => set("logoCorner", e.target.value as BrandKitForm["logoCorner"])}
                    className="appearance-none bg-transparent pr-5 outline-none"
                  >
                    {LogoCorners.map((c) => (
                      <option key={c} value={c}>
                        {cornerNames[c]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-ink-3" />
                </label>
              </div>
            </div>
          </section>

          {/* 2. Colors */}
          <section className={section}>
            <SectionHead
              title="Colors"
              text="The accent styles hook titles, highlights, stats and the spoken caption word."
            />
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ColorField label="Accent / Highlights" value={form.accent} onChange={(c) => set("accent", c)} />
              <ColorField label="Background & Cards" value={form.base} onChange={(c) => set("base", c)} />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold tracking-wide text-ink-3">Preset colorways</span>
              <div className="flex flex-wrap gap-2.5">
                {presets.map((p) => {
                  const on = form.accent === p.accent && form.base === p.base;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setForm((f) => ({ ...f, accent: p.accent, base: p.base }))}
                      className={cn(
                        "flex items-center gap-2 rounded-lg bg-panel px-2.5 py-1.5 transition-colors",
                        on ? selected : unselected,
                      )}
                    >
                      <span className="flex -space-x-1.5">
                        <span
                          className="size-4 rounded-full border border-white"
                          style={{ backgroundColor: p.accent }}
                        />
                        <span className="size-4 rounded-full border border-white" style={{ backgroundColor: p.base }} />
                      </span>
                      <span className={cn("text-[11px] font-semibold", on ? "text-ink" : "text-ink-3")}>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 3. Font */}
          <section className={section}>
            <SectionHead title="Font family" text="Used for on-screen titles, captions and numbers." />
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(Object.keys(fontInfo) as BrandKitForm["font"][]).map((f) => {
                const on = form.font === f;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("font", f)}
                    className={cn(
                      "relative flex flex-col rounded-lg bg-panel p-2.5 text-left",
                      on ? selected : unselected,
                    )}
                  >
                    <span className={cn("text-[11px] text-ink", on ? "font-semibold" : "font-medium")}>
                      {fontInfo[f].name}
                    </span>
                    <span className="mt-0.5 text-[10px] text-ink-3">{fontInfo[f].kind}</span>
                    {on && <Check className="absolute top-2 right-2 size-4 text-teal-ink" />}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-[13px]">Title casing</span>
              <div className="inline-flex rounded-lg border border-line bg-paper p-0.5">
                {TitleCasings.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={form.casing === c}
                    onClick={() => set("casing", c)}
                    className={cn(
                      "rounded px-2.5 py-1 text-[11px] font-semibold",
                      form.casing === c ? "bg-panel text-ink shadow-xs" : "text-ink-3 hover:text-ink",
                    )}
                  >
                    {casingNames[c]}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 4. Captions */}
          <section className={section}>
            <SectionHead title="Caption style" text="Word-by-word captions, timed to the voice." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {CaptionStyles.map((c) => {
                const on = form.captionStyle === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("captionStyle", c)}
                    className={cn(
                      "flex flex-col gap-2.5 rounded-lg bg-panel p-3 text-left",
                      on ? selected : unselected,
                    )}
                  >
                    <span
                      className="flex h-16 items-center justify-center rounded p-2 text-center"
                      style={{ backgroundColor: form.base }}
                    >
                      <CaptionSample style={c} accent={form.accent} />
                    </span>
                    <span className="flex items-center justify-between">
                      <span className={cn("text-[11px] font-semibold", on ? "text-ink" : "text-ink-3")}>
                        {captionNames[c]}
                      </span>
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full",
                          on ? "border-2 border-ink" : "border border-line",
                        )}
                      >
                        {on && <span className="size-2 rounded-full bg-ink" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 5. Voice (the same setting as Settings → Defaults) */}
          <section className={section}>
            <SectionHead title="Default voice" text="The narrator for new videos. Same as Settings → Defaults." />
            <div className="space-y-2">
              {Voices.map((v) => {
                const on = voiceId === v.id;
                const info = voiceInfo[v.name] ?? { label: v.name, kind: "" };
                return (
                  <div
                    key={v.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg bg-panel p-3",
                      on ? selected : unselected,
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        aria-label={`${playingVoice === v.id ? "Stop" : "Play"} ${v.name} sample`}
                        onClick={() => playVoice(v.id)}
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          on ? "bg-ink text-white" : "border border-line bg-paper hover:bg-wash",
                        )}
                      >
                        {playingVoice === v.id ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      </button>
                      <div className="flex min-w-0 flex-col">
                        <span className={cn("text-sm", on ? "font-semibold" : "font-medium")}>{info.label}</span>
                        <span className="text-[11px] text-ink-3">{info.kind}</span>
                      </div>
                    </div>
                    {on ? (
                      <CheckCircle2 className="size-5 shrink-0 text-teal-ink" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVoiceId(v.id)}
                        className="rounded px-2 py-1 text-[11px] font-semibold text-ink-3 hover:text-ink"
                      >
                        Select
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 6. Call-to-action */}
          <section className={section}>
            <SectionHead title="Default call-to-action" text="The closing line the AI writes into the last scene." />
            <label className="relative block">
              <span className="sr-only">Call-to-action</span>
              <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
              <input
                value={form.cta}
                maxLength={CTA_MAX}
                placeholder="e.g. Follow for more"
                onChange={(e) => set("cta", e.target.value)}
                className="h-10 w-full rounded-lg border border-line bg-panel pr-16 pl-9 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-teal/20"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[11px] text-ink-3">
                {form.cta.length} / {CTA_MAX}
              </span>
            </label>
            {!form.cta.trim() && (
              <p className="mt-2 text-[11px] text-ink-3">Empty: the AI picks a closing line that fits the format.</p>
            )}
          </section>

          {/* 7. Intro & outro: Step K2 */}
          <section className={cn(section, "bg-wash/40 opacity-60 select-none")}>
            <div className="mb-4 flex items-center gap-2.5">
              <h2 className="font-heading text-lg font-semibold tracking-tight text-ink-2">Intro &amp; outro clips</h2>
              <span className="rounded-md bg-line px-2 py-0.5 text-[10px] font-medium tracking-wider text-ink-2 uppercase">
                Soon
              </span>
            </div>
            <p className="text-[13px] text-ink-3">
              Your own short clips, played before the hook and after the call-to-action.
            </p>
          </section>
        </div>
      </div>

      {/* Save bar, docked to the bottom of the page. */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-8 -mb-8 border-t border-line bg-panel/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:-mb-12">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setForm(defaultBrandKit);
              setLogoSrc(null);
            }}
            className="rounded px-3 py-1.5 text-sm text-ink-2 hover:text-ink"
          >
            Reset to default
          </button>
          <button
            type="button"
            disabled={saving || uploading || !dirty}
            onClick={save}
            className="flex items-center gap-2 rounded-lg bg-lime px-6 py-2.5 text-sm font-semibold text-ink shadow-[0_4px_16px_rgba(198,244,50,0.35)] transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save brand kit
          </button>
        </div>
      </div>
    </div>
  );
}
