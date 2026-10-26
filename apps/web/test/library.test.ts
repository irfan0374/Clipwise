import { describe, expect, it } from "vitest";
import { downloadName, escapeSearch, libraryFilter, libraryQuery } from "../lib/library-query";

describe("library isolation and query parsing", () => {
  it("normalizes malformed URL parameters", () => {
    expect(libraryQuery.parse({ page: "-2", status: "unknown", q: ["bad"], sort: "bad" })).toMatchObject({
      page: 1,
      status: "all",
      q: "",
      sort: "newest",
      view: "list",
    });
  });
  it("always scopes queries to the owner workspace and excludes deleted videos", () => {
    expect(libraryFilter("workspace", libraryQuery.parse({ status: "failed" }))).toEqual({
      workspaceId: "workspace",
      deletedAt: null,
      status: "failed",
    });
  });
  it("searches regex characters literally", () => {
    const text = "Sky (blue)? [a-z] .* + $ \\";
    const re = new RegExp(escapeSearch(text), "i");
    expect(re.test(text)).toBe(true);
    expect(re.test("Sky blue sky")).toBe(false);
    expect(escapeSearch(".*")).toBe("\\.\\*");
  });
  it("produces safe attachment filenames even for quotes, Unicode and newlines", () => {
    expect(downloadName('A "blue" sky\r\n')).toBe("A-blue-sky.mp4");
    expect(downloadName("☀")).toBe("clipwise-video.mp4");
  });
});
