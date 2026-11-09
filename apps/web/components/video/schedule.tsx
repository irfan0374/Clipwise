"use client";
import { CalendarDays, Clock, Globe, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { rescheduleInstagramPost } from "@/app/(app)/post-actions";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { dayKey, fromInputs, scheduleProblem, timeKey, whenText, zoneLabel } from "@/lib/when";

// Date + time for a scheduled post (Stitch "Post to Instagram Modal", Schedule selected) and the Reschedule window.

const field =
  "flex h-11 items-center gap-2.5 rounded-xl border border-line bg-panel px-3 text-sm focus-within:border-ink focus-within:ring-2 focus-within:ring-teal/20";

export function ScheduleFields({
  day,
  time,
  onChange,
  disabled,
}: {
  day: string;
  time: string;
  onChange: (next: { day: string; time: string }) => void;
  disabled?: boolean;
}) {
  const now = new Date();
  const last = new Date(now.getTime() + 60 * 86_400_000);
  const problem = scheduleProblem(fromInputs(day, time), now);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2.5">
        <label className={field}>
          <CalendarDays className="size-4 shrink-0 text-ink-2" />
          <span className="sr-only">Date</span>
          <input
            type="date"
            value={day}
            min={dayKey(now)}
            max={dayKey(last)}
            disabled={disabled}
            onChange={(e) => onChange({ day: e.target.value, time })}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <label className={field}>
          <Clock className="size-4 shrink-0 text-ink-2" />
          <span className="sr-only">Time</span>
          <input
            type="time"
            value={time}
            disabled={disabled}
            onChange={(e) => onChange({ day, time: e.target.value })}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-ink-2">
        <Globe className="size-3.5 text-teal-ink" />
        {zoneLabel(fromInputs(day, time) ?? now)}
      </p>
      {problem && day && time && <p className="text-xs text-red-ink">{problem}</p>}
    </div>
  );
}

/** "Reschedule" for a post that hasn't gone out yet. */
export function RescheduleDialog({
  post,
  onClose,
  onDone,
}: {
  post: { id: string; publishAt: string; title?: string } | null;
  onClose: () => void;
  onDone: (publishAt: string) => void;
}) {
  const [value, setValue] = useState<{ day: string; time: string } | null>(null);
  const [saving, start] = useTransition();
  const current = post ? new Date(post.publishAt) : null;
  const shown = value ?? (current ? { day: dayKey(current), time: timeKey(current) } : { day: "", time: "" });
  const at = fromInputs(shown.day, shown.time);

  const save = () =>
    start(async () => {
      if (!post || !at || scheduleProblem(at)) return;
      try {
        const res = await rescheduleInstagramPost({ postId: post.id, publishAt: at.toISOString() });
        if (!res.ok) toast.error(res.error.message);
        else {
          toast.success(`Moved to ${whenText(res.data.publishAt)}`);
          onDone(res.data.publishAt);
          setValue(null);
        }
      } catch {
        toast.error("Couldn't reschedule. Try again.");
      }
    });

  return (
    <Dialog
      open={Boolean(post)}
      onOpenChange={(o) => {
        if (!o && !saving) {
          setValue(null);
          onClose();
        }
      }}
    >
      <DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-md">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <DialogTitle className="font-heading text-lg font-semibold">Reschedule</DialogTitle>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1 text-ink-2 hover:bg-wash"
          >
            <X className="size-5" />
          </button>
        </div>
        <DialogDescription className="sr-only">Choose a new date and time for this post.</DialogDescription>
        <div className="flex flex-col gap-4 p-5">
          {post?.title && <p className="line-clamp-2 text-sm font-semibold">{post.title}</p>}
          {current && <p className="text-xs text-ink-3">Now: {whenText(current)}</p>}
          <ScheduleFields day={shown.day} time={shown.time} onChange={setValue} disabled={saving} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line bg-paper px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2.5 text-sm text-ink-2 hover:bg-wash"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !at || Boolean(scheduleProblem(at))}
            className="flex items-center gap-2 rounded-lg bg-lime px-5 py-2.5 text-sm font-semibold text-ink shadow-[0_4px_14px_0_rgba(198,244,50,0.35)] disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarDays className="size-4" />}
            Save new time
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
