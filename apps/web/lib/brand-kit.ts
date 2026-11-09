import { BrandFonts, CaptionStyles, defaultBrandStyle, LogoCorners, TitleCasings } from "@clipwise/video";
import { z } from "zod";

// Brand kit form: shared by the page (browser) and the save action (server).

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const CTA_MAX = 40;

export const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a color like #3B82F6.");

export const BrandKitForm = z.object({
  accent: Hex,
  base: Hex,
  font: z.enum(BrandFonts),
  casing: z.enum(TitleCasings),
  captionStyle: z.enum(CaptionStyles),
  showLogo: z.boolean(),
  logoCorner: z.enum(LogoCorners),
  cta: z.string().trim().max(CTA_MAX, `Keep the call-to-action under ${CTA_MAX} characters.`),
  logo: z.object({ key: z.string().max(200), name: z.string().max(120), bytes: z.number().int().min(1) }).nullable(),
});
export type BrandKitForm = z.infer<typeof BrandKitForm>;

/** Clipwise's own look ("Reset to default"). */
export const defaultBrandKit: BrandKitForm = {
  accent: defaultBrandStyle.accent,
  base: defaultBrandStyle.base,
  font: defaultBrandStyle.font,
  casing: defaultBrandStyle.casing,
  captionStyle: defaultBrandStyle.captionStyle,
  showLogo: true,
  logoCorner: "topRight",
  cta: "",
  logo: null,
};

/** The six colour sets from the Stitch Brand kit screen. */
export const presets = [
  { name: "Electric Blue", accent: "#3B82F6", base: "#0B0B0F" },
  { name: "Electric Lime", accent: "#C6F432", base: "#0F0F0F" },
  { name: "Cyber Pink", accent: "#EC4899", base: "#0F172A" },
  { name: "Violet Obsidian", accent: "#8B5CF6", base: "#09090B" },
  { name: "Emerald Slate", accent: "#10B981", base: "#1E293B" },
  { name: "Sunset Amber", accent: "#F59E0B", base: "#1C1917" },
] as const;

export const fontInfo: Record<BrandKitForm["font"], { name: string; kind: string }> = {
  geist: { name: "Geist", kind: "Geometric" },
  inter: { name: "Inter", kind: "Neo-grotesque" },
  poppins: { name: "Poppins", kind: "Rounded" },
  montserrat: { name: "Montserrat", kind: "Architectural" },
  dmSans: { name: "DM Sans", kind: "Humanist" },
};

export const cornerNames: Record<BrandKitForm["logoCorner"], string> = {
  topRight: "Top right corner",
  topLeft: "Top left corner",
  bottomRight: "Bottom right corner",
  bottomLeft: "Bottom left corner",
};

/** What a logo file is, from its first bytes (the browser's type and file name aren't trusted), or why not. */
export function checkLogo(bytes: Uint8Array): { ext: "png" | "webp" | "svg" } | { error: string } {
  if (bytes.length > LOGO_MAX_BYTES) return { error: "The logo is larger than 2 MB." };
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return { ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp" };
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text)) {
    // Shown with <img> and drawn into videos only, but stored files can be opened directly: refuse anything active.
    if (
      /<script|<foreignObject|<iframe|<embed|<object|javascript:|\son[a-z]+\s*=/i.test(text) ||
      /(?:xlink:)?href\s*=\s*["'](?!#|data:image\/(?:png|jpeg|webp);)/i.test(text)
    )
      return { error: "This SVG contains scripts or links. Export it again as a plain SVG or PNG." };
    return { ext: "svg" };
  }
  return { error: "Use a PNG, SVG or WebP file." };
}
