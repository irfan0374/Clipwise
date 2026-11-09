import "server-only";
import { connectDb, SocialAccount } from "@clipwise/db";
import { missingInstagramSettings, videoPosts } from "@clipwise/queue";
import type { Types } from "mongoose";

/** The state cookie that ties Meta's redirect back to the browser that started it (blocks forged callbacks). */
export const STATE_COOKIE = "cw_ig_state";
export const STATE_COOKIE_PATH = "/api/oauth/instagram";

/** Where Meta sends people back. Must match a redirect URL registered in the Unified login configuration exactly. */
export const instagramRedirectUri = (requestUrl: string) =>
  `${(process.env.APP_URL || new URL(requestUrl).origin).replace(/\/$/, "")}/api/oauth/instagram/callback`;

/** Settings → Connections with a result flag the page turns into a message. */
export const connectionsUrl = (requestUrl: string, result: Record<string, string>) => {
  const url = new URL("/settings", process.env.APP_URL || new URL(requestUrl).origin);
  url.searchParams.set("tab", "connections");
  for (const [k, v] of Object.entries(result)) url.searchParams.set(k, v);
  return url;
};

/** The workspace's Instagram accounts (no keys), and whether this server can connect Instagram at all. */
export async function instagramAccounts(workspaceId: Types.ObjectId) {
  await connectDb();
  const accounts = await SocialAccount.find({ workspaceId }).sort({ connectedAt: 1 }).lean();
  return {
    available: missingInstagramSettings().length === 0,
    accounts: accounts.map((a) => ({
      id: a._id.toString(),
      username: a.username,
      pictureUrl: a.pictureUrl ?? null,
      connected: a.status === "connected",
    })),
  };
}

/** What the video page needs for "Post to Instagram": connected accounts and this video's posts. */
export async function instagramForVideo(workspaceId: Types.ObjectId, videoId: string) {
  return { ...(await instagramAccounts(workspaceId)), posts: await videoPosts(workspaceId, videoId) };
}
export type InstagramForVideo = Awaited<ReturnType<typeof instagramForVideo>>;
