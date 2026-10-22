"use client";

import { Formats, VideoStatuses } from "@clipwise/shared";
import { Clapperboard, Download, Info, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { ChipGroup } from "@/components/app/chip-group";
import { EmptyState } from "@/components/app/empty-state";
import { Logo } from "@/components/app/logo";
import { Segmented } from "@/components/app/segmented";
import { StatusBadge } from "@/components/app/status-badge";
import { UsageMeter } from "@/components/app/usage-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const swatches = [
  ["Paper", "bg-paper", "#F6F7F2"],
  ["Panel", "bg-panel", "#FFFFFF"],
  ["Line", "bg-line", "#E7E7E0"],
  ["Ink", "bg-ink", "#0F0F0F"],
  ["Ink 2", "bg-ink-2", "#5C5C57"],
  ["Ink 3", "bg-ink-3", "#8A8A84"],
  ["Lime", "bg-lime", "#C6F432"],
  ["Teal", "bg-teal", "#14B8A6"],
  ["Teal ink", "bg-teal-ink", "#0F766E"],
  ["Amber", "bg-amber", "#F59E0B"],
  ["Red", "bg-red", "#EF4444"],
] as const;

const lengthOptions = [
  { value: "30", label: "30s" },
  { value: "60", label: "60s" },
  { value: "auto", label: "Auto" },
] as const;

const formatOptions = Formats.map((f) => ({ value: f, label: f[0]?.toUpperCase() + f.slice(1) }));

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-5 border-t border-line pt-10">
      <div className="space-y-1">
        <h2 className="text-h2">{title}</h2>
        {note && <p className="text-small text-ink-2">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[140px_1fr] sm:items-center">
      <span className="text-label font-medium tracking-wide text-ink-3 uppercase">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function StyleTile() {
  const [length, setLength] = useState<"30" | "60" | "auto">("60");
  const [format, setFormat] = useState<(typeof Formats)[number]>("explainer");
  const [captions, setCaptions] = useState(true);

  return (
    <div className="mx-auto max-w-[1120px] space-y-10 px-4 py-10 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Logo href="/create" />
          <h1 className="text-h1">Design system</h1>
          <p className="max-w-xl text-ink-2">
            Every Clipwise component and state on one page. Lime is a fill for the one main action; teal is for status
            and links; ink marks what's selected.
          </p>
        </div>
        <Badge variant="outline">Dev only · not in production</Badge>
      </header>

      <Section title="Colour" note="Lime is never used as text on a light background.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {swatches.map(([name, cls, hex]) => (
            <div key={name} className="overflow-hidden rounded-xl border border-line bg-panel">
              <div className={`h-16 ${cls} border-b border-line`} />
              <div className="px-3 py-2">
                <p className="text-small font-medium">{name}</p>
                <p className="text-label text-ink-3 tabular-nums">{hex}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type" note="Sora for headings, Inter for everything else. Numbers use tabular figures.">
        <div className="space-y-3 rounded-xl border border-line bg-panel p-6">
          <p className="font-heading text-h1 font-semibold">H1 · Turn any idea into a short video</p>
          <p className="font-heading text-h2 font-semibold">H2 · Storyboard</p>
          <p className="font-heading text-h3 font-semibold">H3 · Scene 3 of 8</p>
          <p className="text-body">
            Body 15 · Clipwise writes the script, checks the facts, records the voice and animates every scene.
          </p>
          <p className="text-small text-ink-2">Small 13 · Fact-checked 2 minutes ago</p>
          <p className="text-label text-ink-3">Label 12 · 0:58 · 1080 × 1920</p>
        </div>
      </Section>

      <Section title="Buttons">
        <Row label="Variants">
          <Button>
            <Sparkles /> Generate video
          </Button>
          <Button variant="secondary">Edit script</Button>
          <Button variant="ink">Selected</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">
            <Trash2 /> Delete
          </Button>
          <Button variant="link">View fact-check</Button>
        </Row>
        <Row label="Sizes">
          <Button size="lg">Large</Button>
          <Button>Default</Button>
          <Button size="sm">Small</Button>
          <Button variant="secondary" size="icon" aria-label="Download">
            <Download />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Add scene">
            <Plus />
          </Button>
        </Row>
        <Row label="States">
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </Row>
      </Section>

      <Section title="Inputs">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Textarea
              id="topic"
              rows={4}
              className="min-h-28 text-body"
              placeholder="e.g. 3 reasons our oat-milk latte is better than your usual"
            />
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="How GPS knows where you are" />
            </div>
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select defaultValue="liam">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="liam">Liam</SelectItem>
                  <SelectItem value="jessica">Jessica</SelectItem>
                  <SelectItem value="george">George</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Row label="Segmented">
          <Segmented label="Length" options={[...lengthOptions]} value={length} onChange={setLength} />
          <span className="text-small text-ink-3">Selected: {length}</span>
        </Row>
        <Row label="Chips">
          <ChipGroup label="Format" options={formatOptions} value={format} onChange={setFormat} />
        </Row>
        <Row label="Toggle">
          <div className="flex items-center gap-3">
            <Switch id="captions" checked={captions} onCheckedChange={setCaptions} />
            <Label htmlFor="captions">Burn-in captions</Label>
          </div>
        </Row>
      </Section>

      <Section title="Status">
        <Row label="Video status">
          {VideoStatuses.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </Row>
        <Row label="Other badges">
          <Badge variant="teal">Fact-checked</Badge>
          <Badge variant="teal-outline">Scheduled</Badge>
          <Badge variant="amber">2 notes to review</Badge>
          <Badge variant="ink">60s</Badge>
          <Badge variant="outline">Explainer</Badge>
        </Row>
        <Row label="Progress">
          <div className="w-full max-w-md space-y-3">
            <Progress value={12} aria-label="Writing script" />
            <Progress value={58} aria-label="Rendering" />
            <Progress value={100} aria-label="Done" />
          </div>
        </Row>
        <Row label="Usage meter">
          <div className="w-60">
            <UsageMeter label="Videos today" used={3} limit={10} />
          </div>
        </Row>
        <Row label="Toast">
          <Button
            variant="secondary"
            onClick={() => toast.success("Video ready", { description: "How GPS knows where you are · 0:58" })}
          >
            Success toast
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.error("Render failed", { description: "Try again in a minute." })}
          >
            Error toast
          </Button>
        </Row>
      </Section>

      <Section title="Layout">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>How GPS knows where you are</CardTitle>
              <CardDescription>Explainer · 60s · Liam</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <StatusBadge status="rendered" />
                <Badge variant="teal">Fact-checked</Badge>
              </div>
              <p className="text-small text-ink-2">8 scenes · 137 words · 0:58</p>
            </CardContent>
            <CardFooter className="gap-2 border-t border-line bg-paper/60 py-4">
              <Button size="sm">
                <Download /> Download
              </Button>
              <Button size="sm" variant="ghost">
                Open editor
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>Skeletons while data arrives</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-5 w-2/3 bg-wash" />
              <Skeleton className="h-4 w-full bg-wash" />
              <Skeleton className="h-4 w-5/6 bg-wash" />
            </CardContent>
          </Card>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Title</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Length</TableHead>
                <TableHead className="pr-5 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                [
                  ["How GPS knows where you are", "Explainer", "0:58", "rendered"],
                  ["Why is the sky blue?", "Explainer", "0:30", "previewed"],
                  ["Why do cats purr?", "Tips", "—", "failed"],
                ] as const
              ).map(([title, fmt, len, status]) => (
                <TableRow key={title}>
                  <TableCell className="pl-5 font-medium">{title}</TableCell>
                  <TableCell className="text-ink-2">{fmt}</TableCell>
                  <TableCell className="text-ink-2 tabular-nums">{len}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <StatusBadge status={status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <EmptyState
          icon={Clapperboard}
          title="No videos yet"
          description="Describe an idea and Clipwise turns it into a ready-to-post short video."
          action={
            <Button>
              <Wand2 /> Create your first video
            </Button>
          }
        />

        <Row label="Overlays">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open modal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this video?</DialogTitle>
                <DialogDescription>It moves to the trash and is removed for good after 30 days.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive" onClick={() => toast("Moved to trash")}>
                    Delete
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="About fact-checking">
                <Info />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Every claim is checked by a second AI pass</TooltipContent>
          </Tooltip>
        </Row>
      </Section>
    </div>
  );
}
