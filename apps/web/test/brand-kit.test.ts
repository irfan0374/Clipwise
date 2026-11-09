import { describe, expect, it } from "vitest";
import { BrandKitForm, checkLogo, defaultBrandKit } from "../lib/brand-kit";

const text = (s: string) => new TextEncoder().encode(s);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const webp = text("RIFF\0\0\0\0WEBPVP8 ");

describe("brand kit logo", () => {
  it("accepts PNG, WebP and plain SVG by their content, not their name", () => {
    expect(checkLogo(png)).toEqual({ ext: "png" });
    expect(checkLogo(webp)).toEqual({ ext: "webp" });
    expect(
      checkLogo(text('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')),
    ).toEqual({ ext: "svg" });
    expect(checkLogo(text('<svg><use href="#a"/></svg>'))).toEqual({ ext: "svg" });
  });

  it("refuses other files, SVGs with scripts or outside links, and files over 2 MB", () => {
    expect(checkLogo(text("GIF89a"))).toHaveProperty("error");
    expect(checkLogo(text("<html><svg></svg></html>"))).toHaveProperty("error");
    for (const bad of [
      "<svg><script>alert(1)</script></svg>",
      '<svg onload="alert(1)"></svg>',
      '<svg><a href="javascript:alert(1)">x</a></svg>',
      '<svg><image href="https://evil.example/x.png"/></svg>',
      "<svg><foreignObject><div/></foreignObject></svg>",
    ])
      expect(checkLogo(text(bad))).toEqual({ error: expect.stringMatching(/scripts or links/) });
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(png);
    expect(checkLogo(big)).toEqual({ error: "The logo is larger than 2 MB." });
  });
});

describe("brand kit form", () => {
  it("accepts the defaults and trims the call-to-action", () => {
    expect(BrandKitForm.parse({ ...defaultBrandKit, cta: "  Follow for more  " }).cta).toBe("Follow for more");
  });

  it("refuses bad colours, unknown options and a call-to-action over 40 characters", () => {
    expect(BrandKitForm.safeParse({ ...defaultBrandKit, accent: "blue" }).success).toBe(false);
    expect(BrandKitForm.safeParse({ ...defaultBrandKit, font: "comic-sans" }).success).toBe(false);
    expect(BrandKitForm.safeParse({ ...defaultBrandKit, cta: "x".repeat(41) }).success).toBe(false);
  });
});
