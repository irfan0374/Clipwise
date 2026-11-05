import type { Types } from "mongoose";
import { reserve } from "./budget";
import { nsKey } from "./namespace";
import { redis } from "./redis";

// Fair share: every workspace's own part of the shared Gemini and ElevenLabs budgets, so one busy user can't use
// them up for everyone. Reserved atomically before each request, next to the global budget (guards.ts).

export const fairShare = () => ({
  /** Gemini requests per workspace per UTC day (a video takes about 3–5, an idea list or AI rewrite 1). */
  aiRequestsPerDay: Number(process.env.LIMIT_AI_REQUESTS_PER_DAY ?? 15),
  /** ElevenLabs credits per workspace per UTC month (a 30s voiceover takes about 250–400). */
  voiceCreditsPerMonth: Number(process.env.LIMIT_VOICE_CREDITS_PER_MONTH ?? 1500),
});

type Id = Types.ObjectId | string;
const day = (d = new Date()) => d.toISOString().slice(0, 10);
const month = (d = new Date()) => d.toISOString().slice(0, 7);

export const fairKeys = {
  aiRequests: (workspaceId: Id, d = new Date()) => nsKey(`fair:${workspaceId}:ai:${day(d)}`),
  voiceCredits: (workspaceId: Id, d = new Date()) => nsKey(`fair:${workspaceId}:voice:${month(d)}`),
};

/** First day of next UTC month (when the voice share resets). */
export const nextMonthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

/** Takes one Gemini request from the workspace's share for today. False = share used up (nothing taken). */
export const reserveFairAiRequest = (workspaceId: Id) =>
  reserve(fairKeys.aiRequests(workspaceId), 1, fairShare().aiRequestsPerDay, 2 * 24 * 3600);

/** Reserves voice credits from the workspace's share for this month. False = not enough left (nothing taken). */
export const reserveFairVoiceCredits = (workspaceId: Id, credits: number) =>
  reserve(fairKeys.voiceCredits(workspaceId), credits, fairShare().voiceCreditsPerMonth, 40 * 24 * 3600);

/** Gives credits back (the request failed, or the global budget refused it after the share was taken). */
export async function releaseFairVoiceCredits(workspaceId: Id, credits: number) {
  if (credits > 0) await redis().decrby(fairKeys.voiceCredits(workspaceId), credits);
}

/** Gives one Gemini request back (the global budget refused it after the share was taken). */
export async function releaseFairAiRequest(workspaceId: Id) {
  await redis().decr(fairKeys.aiRequests(workspaceId));
}

export async function fairUsage(workspaceId: Id) {
  const [ai, voice] = await redis().mget(fairKeys.aiRequests(workspaceId), fairKeys.voiceCredits(workspaceId));
  const share = fairShare();
  return {
    aiRequests: { used: Number(ai ?? 0), limit: share.aiRequestsPerDay },
    voiceCredits: { used: Number(voice ?? 0), limit: share.voiceCreditsPerMonth },
  };
}

export const aiShareMessage = () =>
  `You've used today's ${fairShare().aiRequestsPerDay} AI requests. They reset at midnight UTC.`;
export const voiceShareMessage = (needed?: number, left?: number) =>
  needed !== undefined && left !== undefined
    ? `This voiceover needs about ${needed} voice credits and you have ${Math.max(0, left)} of ${fairShare().voiceCreditsPerMonth} left this month. They reset on the 1st.`
    : `You've used this month's ${fairShare().voiceCreditsPerMonth} voice credits. They reset on the 1st.`;
