import { VideoStatuses } from "@clipwise/shared";
import { describe, expect, it } from "vitest";
import { videoStatusBadge } from "../components/app/status-badge";
import { isActive, navItems } from "../lib/nav";

describe("sidebar nav", () => {
  it("marks a page and its sub-pages active, nothing else", () => {
    expect(isActive("/videos", "/videos")).toBe(true);
    expect(isActive("/videos/64b7f0c2a1b2c3d4e5f60718", "/videos")).toBe(true);
    expect(isActive("/videosx", "/videos")).toBe(false);
    expect(isActive("/create", "/videos")).toBe(false);
  });

  it("lists working pages first-class and v1 pages as soon", () => {
    expect(navItems.filter((i) => !i.soon).map((i) => i.label)).toEqual(["Create", "Videos", "Settings"]);
    expect(navItems.filter((i) => i.soon).map((i) => i.label)).toEqual(["Calendar", "Brand kit"]);
  });
});

describe("video status badge", () => {
  it("has a label for every status", () => {
    for (const s of VideoStatuses) expect(videoStatusBadge[s].label).toBeTruthy();
  });

  it("uses lime for work in progress, teal for ready, red for failed", () => {
    expect(videoStatusBadge.rendering.variant).toBe("lime");
    expect(videoStatusBadge.rendered.variant).toBe("teal");
    expect(videoStatusBadge.failed.variant).toBe("red");
  });
});
