import { describe, expect, it } from "vitest";
import { Format, fail, Id, ok, Topic, VoiceId, Voices } from "../src/index";

describe("result helpers", () => {
  it("wraps data", () => {
    expect(ok(5)).toEqual({ ok: true, data: 5 });
  });

  it("omits retryAfter when not given", () => {
    expect(fail("BUSY", "Already working on it.")).toEqual({
      ok: false,
      error: { code: "BUSY", message: "Already working on it." },
    });
    expect(fail("LIMIT_REACHED", "Limit", 60)).toMatchObject({ error: { retryAfter: 60 } });
  });
});

describe("common inputs", () => {
  it("accepts only Mongo ObjectIds", () => {
    expect(Id.safeParse("64b7f0c2a1b2c3d4e5f60718").success).toBe(true);
    expect(Id.safeParse("not-an-id").success).toBe(false);
  });

  it("trims topics and enforces length", () => {
    expect(Topic.parse("  Why is the sky blue?  ")).toBe("Why is the sky blue?");
    expect(Topic.safeParse("hi").success).toBe(false);
  });

  it("allows only the free-plan voices", () => {
    for (const v of Voices) expect(VoiceId.safeParse(v.id).success).toBe(true);
    expect(VoiceId.safeParse("someLibraryVoice").success).toBe(false);
  });

  it("knows every format", () => {
    expect(Format.options).toEqual(["promo", "explainer", "story", "tips", "recap", "quote"]);
  });
});
