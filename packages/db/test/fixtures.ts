import { readFileSync } from "node:fs";
import { Types } from "mongoose";

const seedFile = (name: string) => JSON.parse(readFileSync(new URL(`../seed/${name}`, import.meta.url), "utf8"));

/** Real prototype scripts: GPS (60s, 8 scenes) and sky (30s, 5 scenes). */
export const gpsScript = () => seedFile("gps.script.json");
export const skyScript = () => seedFile("sky.script.json");

export const newVideo = (overrides: Record<string, unknown> = {}) => ({
  workspaceId: new Types.ObjectId(),
  createdByUserId: "user_1",
  topic: "How does GPS know where you are?",
  lengthMode: "60" as const,
  voiceId: "TX3LPaxmHKxFdv7VOQHJ",
  ...overrides,
});
