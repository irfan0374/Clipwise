import { defaultBrandStyle } from "@clipwise/video";
import { applyCasing, inkOn, resolveBrand } from "@clipwise/video/brand";
import { brandSampleTimeline } from "@clipwise/video/brand-sample";
import { describe, expect, it } from "vitest";

describe("brand kit in videos", () => {
  it("keeps Clipwise's look for videos without a brand, and ignores broken colours", () => {
    expect(resolveBrand(undefined)).toMatchObject({ accent: "#3B82F6", background: "#0B0B0F", text: "#FFFFFF" });
    expect(resolveBrand({ ...defaultBrandStyle, accent: "red", base: "#12" })).toMatchObject({
      accent: "#3B82F6",
      background: "#0B0B0F",
    });
  });

  it("switches to dark text on a light background", () => {
    expect(resolveBrand({ ...defaultBrandStyle, base: "#FAFAF9" })).toMatchObject({ text: "#0B0B0F" });
    expect(inkOn("#C6F432")).toBe("#0B0B0F");
    expect(inkOn("#3B82F6")).toBe("#FFFFFF");
  });

  it("changes hook title casing without breaking names and acronyms", () => {
    expect(applyCasing("why NASA builds rockets in Florida", "upper")).toBe("WHY NASA BUILDS ROCKETS IN FLORIDA");
    expect(applyCasing("why NASA builds rockets in e-bikes", "title")).toBe("Why NASA Builds Rockets In E-Bikes");
    expect(applyCasing("why NASA builds rockets", "sentence")).toBe("why NASA builds rockets");
  });

  it("builds the Brand kit preview with the brand and the call-to-action as the last scene", () => {
    const brand = { ...defaultBrandStyle, accent: "#EC4899" };
    const t = brandSampleTimeline(brand, "Follow Acme for more");
    expect(t.brand).toEqual(brand);
    expect(t.scenes.at(-1)).toMatchObject({ template: "title", onScreenText: ["Follow Acme for more"] });
    expect(t.scenes.at(-1)?.endFrame).toBe(t.durationInFrames);
    expect(t.captionPages.every((p) => p.wordIndexes.length >= 1 && p.wordIndexes.length <= 3)).toBe(true);
    expect(brandSampleTimeline(brand, "").scenes.at(-1)?.onScreenText).toEqual(["Follow for more"]);
  });
});
