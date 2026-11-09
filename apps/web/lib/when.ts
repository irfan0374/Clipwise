// Dates for scheduling, in the browser's own time zone (the server stores and compares UTC).

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-12" for a date input. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "19:00" for a time input. */
export const timeKey = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** The moment a date input and a time input describe, or null when one is empty. */
export function fromInputs(day: string, time: string) {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(h) || Number.isNaN(min)) return null;
  return new Date(y, m - 1, d, h, min);
}

/** A sensible first suggestion: 6 PM on the chosen day, or the next full hour at least an hour away. */
export function suggestedTime(day?: string, now = new Date()) {
  const soon = new Date(now.getTime() + 60 * 60_000);
  soon.setMinutes(0, 0, 0);
  soon.setHours(soon.getHours() + 1);
  if (!day) return soon;
  const evening = fromInputs(day, "18:00");
  return evening && evening > soon ? evening : soon;
}

/** "Asia/Dubai (GMT+4)" */
export function zoneLabel(at = new Date()) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset =
    new Intl.DateTimeFormat("en-US", { timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return offset ? `${zone} (${offset})` : zone;
}

/** Why a scheduled time can't be used (same rules as the server), or null. */
export function scheduleProblem(at: Date | null, now = new Date()) {
  if (!at) return "Choose a date and time.";
  if (at.getTime() < now.getTime() + 5 * 60_000) return "Choose a time at least 5 minutes from now.";
  if (at.getTime() > now.getTime() + 60 * 86_400_000) return "Posts can be scheduled up to 60 days ahead.";
  return null;
}

/** "Thu 12 Nov, 7:00 PM" */
export const whenText = (iso: string | Date) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

/** "7:00 PM" */
export const clockText = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
