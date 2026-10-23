import { connectDb, PipelineRun, Video } from "@clipwise/db";
import type { Format, LengthMode, RunTarget } from "@clipwise/shared";
import type { Types } from "mongoose";
import { publishVideoEvent } from "./events";
import { enqueue } from "./queues";

export type StartVideoInput = {
  workspaceId: Types.ObjectId | string;
  userId: string;
  topic: string;
  format: Format;
  lengthMode: LengthMode;
  voiceId: string;
  /** How far to go: script + fact-check (default), a silent preview MP4, or voice + final MP4. */
  target?: RunTarget;
};

/** Creates the video and its pipeline run, then queues the script job. Returns at once; work happens in the worker. */
export async function startVideo(input: StartVideoInput) {
  await connectDb();
  const video = await Video.create({
    workspaceId: input.workspaceId,
    createdByUserId: input.userId,
    topic: input.topic,
    format: input.format,
    lengthMode: input.lengthMode,
    voiceId: input.voiceId,
    status: "draft",
  });
  const run = await PipelineRun.create({
    workspaceId: input.workspaceId,
    videoId: video._id,
    trigger: "create",
    target: input.target ?? "script",
  });
  const ids = { videoId: video._id.toString(), runId: run._id.toString() };
  await enqueue("script", ids);
  await publishVideoEvent(ids.videoId, { type: "status", status: "draft", stage: null, progress: 0 });
  return ids;
}
