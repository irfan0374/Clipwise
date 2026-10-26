import type { Video } from "@clipwise/db";
import type { QueryFilter, Types } from "mongoose";
import { z } from "zod";
export const libraryQuery = z.object({
  q: z.string().max(80).catch(""),
  status: z.enum(["all", "rendered", "previewed", "in_progress", "failed"]).catch("all"),
  sort: z.enum(["newest", "oldest"]).catch("newest"),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
  view: z.enum(["list", "grid"]).catch("list"),
});
export type LibraryQuery = z.infer<typeof libraryQuery>;
export const escapeSearch = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const libraryFilter = (workspaceId: Types.ObjectId | string, query: LibraryQuery): QueryFilter<Video> => ({
  workspaceId,
  deletedAt: null,
  ...(query.status === "all"
    ? {}
    : query.status === "in_progress"
      ? { status: { $in: ["draft", "scripting", "checking", "voicing", "rendering"] } }
      : { status: query.status }),
  ...(query.q.trim()
    ? {
        $or: [
          { title: { $regex: escapeSearch(query.q.trim()), $options: "i" } },
          { topic: { $regex: escapeSearch(query.q.trim()), $options: "i" } },
        ],
      }
    : {}),
});
export const downloadName = (title: string) =>
  `${
    title
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .trim()
      .replace(/ +/g, "-")
      .slice(0, 80) || "clipwise-video"
  }.mp4`;
