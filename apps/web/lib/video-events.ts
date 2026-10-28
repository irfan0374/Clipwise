import type { VideoEvent } from "@clipwise/shared";

/**
 * Listens to one kind of live video event. The browser also fires its own "error" event (no data) whenever the
 * connection drops, e.g. each time the hosting platform ends a long request; those are skipped here, and
 * EventSource reconnects by itself.
 */
export function onVideoEvent(source: EventSource, type: VideoEvent["type"], fn: (event: VideoEvent) => void) {
  source.addEventListener(type, (m) => {
    const data = (m as MessageEvent).data;
    if (typeof data !== "string" || !data) return;
    let event: VideoEvent;
    try {
      event = JSON.parse(data) as VideoEvent;
    } catch {
      return;
    }
    fn(event);
  });
}
