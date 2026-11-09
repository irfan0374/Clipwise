import "server-only";
import type { Workspace } from "@clipwise/db";
import { storage } from "@clipwise/storage";
import type { BrandStyle, LogoCorner } from "@clipwise/video";

type SavedBrand = {
  accent: string;
  base: string;
  font: BrandStyle["font"];
  casing: BrandStyle["casing"];
  captionStyle: BrandStyle["captionStyle"];
  logoCorner: LogoCorner;
  logoKey?: string | null;
};

/** A saved brand (workspace Brand kit or a video's copy) for the in-browser player: the logo as a signed link. */
export async function brandStyleForPlayer(brand: SavedBrand | null | undefined, showLogo = true) {
  if (!brand) return undefined;
  const logoKey = showLogo ? brand.logoKey : null;
  return {
    accent: brand.accent,
    base: brand.base,
    font: brand.font,
    casing: brand.casing,
    captionStyle: brand.captionStyle,
    logo: logoKey ? { src: await storage().signedUrl(logoKey), corner: brand.logoCorner } : null,
  } satisfies BrandStyle;
}

export type BrandKitDoc = NonNullable<Workspace["brandKit"]>;
