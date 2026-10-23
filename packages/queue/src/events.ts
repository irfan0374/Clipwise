import { videoChannel as baseChannel, type VideoEvent } from "@clipwise/shared";
import { newRedis, redis } from "./redis";

// Redis pub/sub is shared by every database on a server (unlike keys and queues), so a namespace keeps
// test events (REDIS_NAMESPACE=test:) out of a dev worker's live log.
const ns = () => process.env.REDIS_NAMESPACE ?? "";
const videoChannel = (videoId: string) => `${ns()}${baseChannel(videoId)}`;

export const publishVideoEvent = (videoId: string, event: VideoEvent) =>
  redis().publish(videoChannel(videoId), JSON.stringify(event));

/** Listens to one video's events until the returned function is called. */
export const subscribeVideoEvents = async (videoId: string, onEvent: (event: VideoEvent) => void) => {
  const sub = newRedis(`sub:${videoId}`);
  await sub.subscribe(videoChannel(videoId));
  sub.on("message", (_channel, message) => {
    try {
      onEvent(JSON.parse(message) as VideoEvent);
    } catch {}
  });
  return async () => {
    await sub.unsubscribe();
    await sub.quit();
  };
};

/** Every video's events (worker logs, admin live view). */
export const subscribeAllVideoEvents = async (onEvent: (videoId: string, event: VideoEvent) => void) => {
  const sub = newRedis("sub:all");
  await sub.psubscribe(videoChannel("*"));
  sub.on("pmessage", (_pattern, channel, message) => {
    try {
      onEvent(channel.slice(videoChannel("").length), JSON.parse(message) as VideoEvent);
    } catch {}
  });
  return async () => {
    await sub.punsubscribe();
    await sub.quit();
  };
};
