import { describe, expect, it, vi } from "vitest";
import { onVideoEvent } from "../lib/video-events";

/** A stand-in for the browser's EventSource that lets the test fire events. */
const fakeSource = () => {
  const handlers = new Map<string, (m: unknown) => void>();
  return {
    addEventListener: (type: string, fn: (m: unknown) => void) => handlers.set(type, fn),
    fire: (type: string, m: unknown) => handlers.get(type)?.(m),
  };
};

describe("live video events", () => {
  it("passes the worker's events on", () => {
    const source = fakeSource();
    const fn = vi.fn();
    onVideoEvent(source as unknown as EventSource, "error", fn);
    const event = { type: "error", stage: "render", code: "INTERNAL", message: "Something went wrong." };
    source.fire("error", { data: JSON.stringify(event) });
    expect(fn).toHaveBeenCalledWith(event);
  });

  it("ignores the browser's own connection errors (no data) and unreadable messages", () => {
    const source = fakeSource();
    const fn = vi.fn();
    onVideoEvent(source as unknown as EventSource, "error", fn);
    source.fire("error", {}); // connection dropped: EventSource reconnects by itself
    source.fire("error", { data: "" });
    source.fire("error", { data: "not json" });
    expect(fn).not.toHaveBeenCalled();
  });
});
