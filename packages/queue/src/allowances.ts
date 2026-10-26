import { Render } from "@clipwise/db";
import type { Types } from "mongoose";
export const finalsPerWeek = () => Number(process.env.LIMIT_FINALS_PER_WEEK ?? 2);
export function weekWindow(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return { start, reset: new Date(start.getTime() + 7 * 86400000) };
}
export const weeklyFinalCount = (workspaceId: Types.ObjectId | string, now = new Date()) =>
  Render.countDocuments({
    workspaceId,
    kind: "final",
    status: { $ne: "failed" },
    $or: [
      { quotaAt: { $gte: weekWindow(now).start } },
      { quotaAt: { $exists: false }, createdAt: { $gte: weekWindow(now).start } },
    ],
  });
