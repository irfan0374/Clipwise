import { loadFont as loadDMSans } from "@remotion/google-fonts/DMSans";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { createContext, useContext } from "react";
import { type BrandFont, type BrandStyle, defaultBrandStyle } from "./types";

// The resolved colours and font every layer reads (useBrand), from the video's Brand kit.

const options = { weights: ["500", "700", "800"] as ("500" | "700" | "800")[], subsets: ["latin"] as "latin"[] };
const loaders: Record<BrandFont, () => { fontFamily: string }> = {
  geist: () => loadGeist("normal", options),
  inter: () => loadInter("normal", options),
  poppins: () => loadPoppins("normal", options),
  montserrat: () => loadMontserrat("normal", options),
  dmSans: () => loadDMSans("normal", options),
};
// Only the chosen font is downloaded, once per page (a render tab or the browser preview).
const loaded = new Map<BrandFont, string>();
export const fontFamilyFor = (font: BrandFont) => {
  let family = loaded.get(font);
  if (!family) {
    family = (loaders[font] ?? loaders.geist)().fontFamily;
    loaded.set(font, family);
  }
  return family;
};

const isHex = (c: string | undefined): c is string => Boolean(c && /^#[0-9a-f]{6}$/i.test(c));
/** 0 (black) … 1 (white), WCAG relative luminance. */
export const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Readable text on top of a colour. */
export const inkOn = (hex: string) => (luminance(hex) > 0.4 ? "#0B0B0F" : "#FFFFFF");

export const resolveBrand = (brand?: Partial<BrandStyle> | null) => {
  const accent = isHex(brand?.accent) ? brand.accent : defaultBrandStyle.accent;
  const background = isHex(brand?.base) ? brand.base : defaultBrandStyle.base;
  const text = inkOn(background);
  const light = text !== "#FFFFFF";
  return {
    accent,
    background,
    text,
    textSecondary: light ? "#52525B" : "#A1A1AA",
    surface: light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)",
    font: brand?.font ?? defaultBrandStyle.font,
    casing: brand?.casing ?? defaultBrandStyle.casing,
    captionStyle: brand?.captionStyle ?? defaultBrandStyle.captionStyle,
    logo: brand?.logo ?? null,
  };
};
export type ResolvedBrand = ReturnType<typeof resolveBrand>;

const BrandContext = createContext<ResolvedBrand>(resolveBrand());
export const BrandProvider = BrandContext.Provider;
export const useBrand = () => useContext(BrandContext);

/** Hook titles in the brand's casing. Title Case only raises first letters, so names and acronyms survive. */
export const applyCasing = (text: string, casing: BrandStyle["casing"]) =>
  casing === "upper"
    ? text.toLocaleUpperCase("en")
    : casing === "title"
      ? text.replace(/(^|[\s-])(\p{Ll})/gu, (_, gap: string, ch: string) => gap + ch.toLocaleUpperCase("en"))
      : text;
