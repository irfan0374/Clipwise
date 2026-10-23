// Object key layout (System Design, storage section). MongoDB stores keys only; URLs are signed on request.
const ws = (workspaceId: string) => `ws/${workspaceId}`;
const video = (workspaceId: string, videoId: string) => `${ws(workspaceId)}/videos/${videoId}`;

export const keys = {
  /** Files that belong to one script version (re-recorded when the narration changes). */
  voice: (w: string, v: string, version: number) => `${video(w, v)}/v${version}/voice.mp3`,
  alignment: (w: string, v: string, version: number) => `${video(w, v)}/v${version}/alignment.json`,
  timeline: (w: string, v: string, version: number) => `${video(w, v)}/v${version}/timeline.json`,
  render: (w: string, v: string, renderId: string) => `${video(w, v)}/renders/${renderId}.mp4`,
  thumbnail: (w: string, v: string, renderId: string) => `${video(w, v)}/thumbnails/${renderId}.jpg`,
  /** Everything for a video, for hard delete. */
  videoPrefix: (w: string, v: string) => `${video(w, v)}/`,
};
