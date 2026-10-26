"use client";
import { Formats, LengthModes, Voices } from "@clipwise/shared";
import { Check, Loader2, LogOut, Save, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSettings } from "@/app/(app)/settings/actions";
import { authClient } from "@/lib/auth-client";
import type { SettingsUsage } from "@/lib/settings";

export type Defaults = {
  name: string;
  defaultFormat: (typeof Formats)[number];
  defaultLength: (typeof LengthModes)[number];
  defaultVoiceId: (typeof Voices)[number]["id"];
};
const input =
  "h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-teal/20";
const card = "rounded-xl border border-line bg-panel p-5 shadow-xs sm:p-6";
const button =
  "flex items-center justify-center gap-2 rounded-lg bg-lime px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50";
const date = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "UTC" });
function Meter({ label, used, limit, reset }: { label: string; used: number; limit: number; reset: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className="my-2 font-heading text-2xl font-semibold tabular-nums">
        {used} <span className="text-base font-normal text-ink-3">/ {limit}</span>
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        className="h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-lime to-teal"
          style={{ width: `${Math.min(100, Math.max(0, limit ? (used / limit) * 100 : 0))}%` }}
        />
      </div>
      <p className="mt-3 text-[11px] text-ink-3">Resets {date(reset)} UTC</p>
    </div>
  );
}
export function SettingsPanel({
  tab,
  defaults,
  usage,
  user,
}: {
  tab: "account" | "defaults" | "usage";
  defaults: Defaults;
  usage: SettingsUsage;
  user: { name: string; email: string };
}) {
  const router = useRouter();
  const [values, setValues] = useState(defaults);
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const save = () =>
    start(async () => {
      try {
        const result = await updateSettings(values);
        if (!result.ok) toast.error(result.error.message);
        else {
          toast.success("Defaults saved");
          router.refresh();
        }
      } catch {
        toast.error("Couldn't save defaults. Try again.");
      }
    });
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-h1">Settings</h1>
        <p className="mt-2 text-sm text-ink-2">Manage your workspace, defaults and beta allowances.</p>
      </header>
      <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Settings" className="flex gap-1 overflow-x-auto md:flex-col">
          {(["account", "defaults", "usage"] as const).map((t) => (
            <Link
              key={t}
              href={`/settings?tab=${t}`}
              aria-current={tab === t ? "page" : undefined}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium capitalize ${tab === t ? "bg-ink text-white" : "text-ink-2 hover:bg-wash"}`}
            >
              {t}
            </Link>
          ))}
          {["Connections", "Billing"].map((t) => (
            <span
              key={t}
              aria-disabled="true"
              className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm text-ink-3"
            >
              {t}
              <span className="text-[10px]">Soon</span>
            </span>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">
          {tab === "usage" && (
            <>
              <section className={card}>
                <h2 className="text-lg font-semibold">Your allowances</h2>
                <p className="mb-5 mt-1 text-sm text-ink-2">
                  Daily allowances reset at midnight UTC. Final renders reset on Monday.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Meter label="Final renders this week" {...usage.finals} reset={usage.weeklyResetAt} />
                  <Meter label="New videos today" {...usage.videos} reset={usage.dailyResetAt} />
                  <Meter label="Idea suggestions today" {...usage.ideas} reset={usage.dailyResetAt} />
                  <Meter label="AI rewrites today" {...usage.aiEdits} reset={usage.dailyResetAt} />
                </div>
                <button
                  type="button"
                  onClick={() => router.refresh()}
                  className="mt-4 text-xs font-medium text-teal-ink"
                >
                  Refresh usage
                </button>
              </section>
              <section className={card}>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal-soft px-2.5 py-1 text-xs font-medium text-teal-ink">
                  <ShieldCheck className="size-3.5" />
                  Beta
                </span>
                <h2 className="mt-3 font-semibold">Free during the beta</h2>
                <p className="mt-1 text-sm text-ink-2">
                  Your workspace has access to the current video creation tools.
                </p>
              </section>
              <section className={card}>
                <h2 className="mb-4 text-lg font-semibold">Recent activity</h2>
                {usage.activity.length ? (
                  <div className="divide-y divide-line">
                    {usage.activity.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{a.title}</p>
                          <p className="mt-1 text-xs text-ink-3">
                            {a.action} · {date(a.date)} UTC
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${a.status === "failed" ? "bg-red-soft text-red-ink" : a.status === "ok" ? "bg-teal-soft text-teal-ink" : "bg-paper text-ink-2"}`}
                        >
                          {a.status === "ok" ? "Completed" : a.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-2">Your generation activity will appear here.</p>
                )}
              </section>
            </>
          )}
          {tab === "defaults" && (
            <form
              className={card}
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <h2 className="text-lg font-semibold">Workspace defaults</h2>
              <p className="mb-6 mt-1 text-sm text-ink-2">Start each new video with your preferred settings.</p>
              <div className="space-y-5">
                <label className="block text-sm font-medium">
                  Workspace name
                  <input
                    className={`${input} mt-2`}
                    value={values.name}
                    required
                    maxLength={80}
                    onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Default format
                  <select
                    className={`${input} mt-2 capitalize`}
                    value={values.defaultFormat}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, defaultFormat: e.target.value as Defaults["defaultFormat"] }))
                    }
                  >
                    {Formats.map((f) => (
                      <option key={f} value={f}>
                        {f[0]?.toUpperCase()}
                        {f.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Default length</legend>
                  <div className="flex rounded-lg border border-line bg-paper p-1">
                    {LengthModes.map((length) => (
                      <button
                        key={length}
                        type="button"
                        aria-pressed={values.defaultLength === length}
                        onClick={() => setValues((v) => ({ ...v, defaultLength: length }))}
                        className={`flex-1 rounded-md py-2 text-sm ${values.defaultLength === length ? "bg-panel font-medium shadow-xs" : "text-ink-2"}`}
                      >
                        {length === "auto" ? "Auto" : `${length}s`}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="block text-sm font-medium">
                  Default voice
                  <select
                    className={`${input} mt-2`}
                    value={values.defaultVoiceId}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, defaultVoiceId: e.target.value as Defaults["defaultVoiceId"] }))
                    }
                  >
                    {Voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" disabled={pending || !values.name.trim()} className={button}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save defaults
                </button>
              </div>
            </form>
          )}
          {tab === "account" && (
            <>
              <section className={card}>
                <h2 className="mb-4 text-lg font-semibold">Account</h2>
                <div className="space-y-3 text-sm">
                  <p>
                    <span className="text-ink-2">Name</span>
                    <strong className="mt-1 block font-medium">{user.name}</strong>
                  </p>
                  <p>
                    <span className="text-ink-2">Email</span>
                    <strong className="mt-1 block break-all font-medium">{user.email}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="mt-5 flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm"
                  onClick={async () => {
                    await authClient.signOut();
                    router.push("/sign-in");
                    router.refresh();
                  }}
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </section>
              <form
                className={card}
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    try {
                      const res = await authClient.changePassword({
                        currentPassword: current,
                        newPassword: password,
                        revokeOtherSessions: true,
                      });
                      if (res.error)
                        toast.error("Couldn't change the password. Check your current password and try again.");
                      else {
                        setCurrent("");
                        setPassword("");
                        toast.success("Password changed. Other sessions were signed out.");
                      }
                    } catch {
                      toast.error("Couldn't change the password. Try again.");
                    }
                  });
                }}
              >
                <h2 className="text-lg font-semibold">Change password</h2>
                <p className="mb-4 mt-1 text-sm text-ink-2">
                  Use at least 12 characters. Other sessions will be signed out.
                </p>
                <label className="mb-4 block text-sm font-medium">
                  Current password
                  <input
                    className={`${input} mt-2`}
                    type="password"
                    autoComplete="current-password"
                    required
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium">
                  New password
                  <input
                    className={`${input} mt-2`}
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button type="submit" disabled={pending} className={`${button} mt-5`}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Change password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
