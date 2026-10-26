"use client";
import {
  Activity,
  Ban,
  FileText,
  KeyRound,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  pauseGeneration,
  resetUserPassword,
  retryFailedVideo,
  suspendWorkspace,
  viewRunLog,
} from "@/app/(app)/admin/actions";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { AdminOverview } from "@/lib/admin";

const panel = "rounded-xl border border-line bg-panel p-5 shadow-xs sm:p-6";
const button =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-ink hover:bg-paper disabled:opacity-45";
const date = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "UTC" });
export function AdminDashboard({ data, search, actorId }: { data: AdminOverview; search: string; actorId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [target, setTarget] = useState<AdminOverview["rows"][number] | null>(null);
  const [confirmation, setConfirmation] = useState<{ row: AdminOverview["rows"][number]; suspended: boolean } | null>(
    null,
  );
  const [log, setLog] = useState<Awaited<ReturnType<typeof viewRunLog>> | null>(null);
  const run = (call: () => Promise<{ ok: boolean; error?: { message: string } }>, done?: () => void) =>
    start(async () => {
      try {
        const result = await call();
        if (!result.ok) toast.error(result.error?.message ?? "Couldn't complete this action.");
        else {
          done?.();
          toast.success("Updated");
          router.refresh();
        }
      } catch {
        toast.error("Couldn't complete this action. Try again.");
      }
    });
  const paused = data.health.some((q) => q.paused);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h1">Admin</h1>
          <p className="mt-2 text-sm text-ink-2">Workspace access, generation health and internal budgets.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={button} onClick={() => router.refresh()}>
            <RefreshCw className="size-4" />
            Refresh
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => pauseGeneration({ paused: !paused, queue: "all" }))}
            className={`${button} ${paused ? "text-red-ink" : "text-teal-ink"}`}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : paused ? (
              <Play className="size-4" />
            ) : (
              <Pause className="size-4" />
            )}
            {paused ? "Resume all queues" : "Pause generation"}
          </button>
        </div>
      </header>
      <section className="grid divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {[
          ["Active workspaces", data.stats.activeWorkspaces],
          ["Videos today", data.stats.videosToday],
          ["Failed videos", data.stats.failedVideos],
          ["Running jobs", data.stats.runningJobs],
        ].map(([label, value]) => (
          <div key={label} className="p-5">
            <p className="text-xs text-ink-2">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>
      <section className={panel}>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Activity className="size-4 text-teal-ink" />
          Queue health
        </h2>
        <p className="mb-4 text-xs text-ink-2">Pausing stops new queued work. A stage already running may finish.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {data.health.map((q) => (
            <div key={q.name} className="rounded-lg border border-line bg-paper p-4">
              <div className="flex items-center justify-between">
                <strong className="text-sm capitalize">{q.name}</strong>
                <span className={`text-xs ${q.paused ? "text-red-ink" : "text-teal-ink"}`}>
                  {q.paused ? "Paused" : "Running"}
                </span>
              </div>
              <p className="my-3 text-xs text-ink-2">
                {q.counts.active ?? 0} active · {(q.counts.waiting ?? 0) + (q.counts.paused ?? 0)} waiting ·{" "}
                {q.counts.delayed ?? 0} delayed · {q.counts.failed ?? 0} failed
              </p>
              <button
                type="button"
                className={button}
                disabled={pending}
                onClick={() => run(() => pauseGeneration({ queue: q.name, paused: !q.paused }))}
              >
                {q.paused ? "Resume" : "Pause"}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className={panel}>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="size-4 text-teal-ink" />
          <h2 className="text-lg font-semibold">Internal provider budgets</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Gemini requests today", data.budgets.gemini],
            ["ElevenLabs credits this month", data.budgets.elevenlabs],
          ].map(([label, value]) => {
            const meter = value as { used: number; limit: number };
            return (
              <div key={String(label)} className="rounded-lg border border-line bg-paper p-4">
                <p className="text-xs text-ink-2">{String(label)}</p>
                <p className="my-2 text-2xl font-semibold tabular-nums">
                  {meter.used.toLocaleString("en-GB")}{" "}
                  <span className="text-sm font-normal text-ink-3">/ {meter.limit.toLocaleString("en-GB")}</span>
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full bg-linear-to-r from-lime to-teal"
                    style={{ width: `${Math.min(100, meter.limit ? (meter.used / meter.limit) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className={panel}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="size-4" />
            Users and workspaces <span className="text-xs font-normal text-ink-3">{data.total}</span>
          </h2>
          <form action="/admin" className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-ink-3" />
            <input
              aria-label="Search users"
              name="q"
              defaultValue={search}
              key={search}
              maxLength={80}
              placeholder="Search name or email"
              className="h-9 w-56 rounded-lg border border-line bg-paper pl-9 pr-3 text-sm"
            />
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                {["User / workspace", "Videos", "Finals this week", "Status", "Actions"].map((t) => (
                  <th key={t} className="pb-3 font-medium">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-4 pr-3">
                    <strong className="block font-medium">
                      {row.userName} {row.role === "admin" && <span className="text-[10px] text-teal-ink">Admin</span>}
                    </strong>
                    <span className="block text-xs text-ink-2">{row.email}</span>
                    <span className="block text-xs text-ink-3">{row.name}</span>
                  </td>
                  <td>{row.videos}</td>
                  <td>{row.finals}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${row.suspended ? "bg-red-soft text-red-ink" : "bg-teal-soft text-teal-ink"}`}
                    >
                      {row.suspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={button}
                        disabled={pending || row.ownerId === actorId || row.role === "admin"}
                        onClick={() => setConfirmation({ row, suspended: !row.suspended })}
                      >
                        <Ban className="size-3.5" />
                        {row.suspended ? "Reactivate" : "Suspend"}
                      </button>
                      <button
                        type="button"
                        className={button}
                        disabled={pending || row.role === "admin" || row.ownerId === actorId}
                        onClick={() => {
                          setPassword("");
                          setTarget(row);
                        }}
                      >
                        <KeyRound className="size-3.5" />
                        Reset password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.rows.length && <p className="py-8 text-center text-sm text-ink-2">No workspaces match this search.</p>}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-ink-2">
          <span>
            Page {data.page} of {data.pages}
          </span>
          <div className="flex gap-2">
            {data.page > 1 && (
              <Link href={`/admin?q=${encodeURIComponent(search)}&page=${data.page - 1}`} className={button}>
                Previous
              </Link>
            )}
            {data.page < data.pages && (
              <Link href={`/admin?q=${encodeURIComponent(search)}&page=${data.page + 1}`} className={button}>
                Next
              </Link>
            )}
          </div>
        </div>
      </section>
      <section className={panel}>
        <h2 className="mb-4 text-lg font-semibold">Processing now</h2>
        <p className="mb-3 text-xs text-ink-2">Latest 20 running video pipelines.</p>
        {data.running.length ? (
          <div className="divide-y divide-line">
            {data.running.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="mt-1 text-xs text-ink-2">
                    {r.stage} · {r.target === "final" ? "Final render" : "Preview"} · Started {date(r.date)} UTC
                  </p>
                </div>
                <button
                  type="button"
                  className={button}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      try {
                        setLog(await viewRunLog({ videoId: r.videoId }));
                      } catch {
                        toast.error("Couldn't load the report. Try again.");
                      }
                    })
                  }
                >
                  View log
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-2">No video pipelines are running.</p>
        )}
      </section>
      <section className={panel}>
        <h2 className="mb-4 text-lg font-semibold">Needs attention</h2>
        {data.failures.length ? (
          <div className="divide-y divide-line">
            {data.failures.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{v.title}</p>
                  <p className="mt-1 text-xs text-ink-2">
                    {v.stage} · {v.message}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={button}
                    disabled={pending}
                    onClick={() => run(() => retryFailedVideo({ videoId: v.id }))}
                  >
                    <RefreshCw className="size-3.5" />
                    Retry
                  </button>
                  <button
                    type="button"
                    className={button}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        try {
                          setLog(await viewRunLog({ videoId: v.id }));
                        } catch {
                          toast.error("Couldn't load the report. Try again.");
                        }
                      })
                    }
                  >
                    <FileText className="size-3.5" />
                    View log
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-2">No failed videos need attention.</p>
        )}
      </section>
      <section className={panel}>
        <h2 className="mb-4 text-lg font-semibold">Admin activity</h2>
        <div className="divide-y divide-line">
          {data.audit.map((a) => (
            <div key={a.id} className="flex flex-wrap justify-between gap-2 py-3 text-xs">
              <div>
                <p className="font-medium">
                  {a.action} · {a.status}
                </p>
                <p className="mt-1 break-all text-ink-3">
                  Target {a.target} · Actor {a.actor}
                </p>
              </div>
              <time className="text-ink-2">{date(a.date)} UTC</time>
            </div>
          ))}
          {!data.audit.length && <p className="text-sm text-ink-2">Administrative changes will be recorded here.</p>}
        </div>
      </section>
      <Dialog open={!!confirmation} onOpenChange={(open) => !open && setConfirmation(null)}>
        <DialogContent>
          <DialogTitle>{confirmation?.suspended ? "Suspend workspace?" : "Reactivate workspace?"}</DialogTitle>
          <DialogDescription>
            {confirmation?.row.email}. Suspension blocks workspace access and new generation. Existing sessions will be
            signed out.
          </DialogDescription>
          <button
            type="button"
            className={button}
            disabled={pending}
            onClick={() => {
              if (confirmation)
                run(
                  () => suspendWorkspace({ workspaceId: confirmation.row.id, suspended: confirmation.suspended }),
                  () => setConfirmation(null),
                );
            }}
          >
            Confirm {confirmation?.suspended ? "suspension" : "reactivation"}
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Reset user password</DialogTitle>
          <DialogDescription>
            Set a new password for {target?.email}. Existing sessions will be signed out. Share the new password
            securely with the user.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (target)
                run(
                  () => resetUserPassword({ workspaceId: target.id, newPassword: password }),
                  () => {
                    setTarget(null);
                    setPassword("");
                  },
                );
            }}
          >
            <label className="block text-sm font-medium">
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-line bg-paper px-3"
              />
            </label>
            <button type="submit" className={`${button} mt-4`} disabled={pending}>
              Reset password and sign out sessions
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!log} onOpenChange={(open) => !open && setLog(null)}>
        <DialogContent>
          <DialogTitle>Run report</DialogTitle>
          <DialogDescription>Latest saved pipeline run. Provider secrets are redacted.</DialogDescription>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-paper p-4 text-xs">
            {log ? JSON.stringify(log.ok ? log.data : log.error, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
