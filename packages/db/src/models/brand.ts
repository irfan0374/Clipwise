import { BrandFonts, CaptionStyles, LogoCorners, TitleCasings } from "@clipwise/video";
import { Schema } from "mongoose";

const hex = { type: String, match: /^#[0-9A-Fa-f]{6}$/, required: true };

/** The look every new video gets. Shared by the workspace's Brand kit and the copy saved on each video. */
const brandFields = {
  accent: hex,
  base: hex,
  font: { type: String, enum: BrandFonts, required: true },
  casing: { type: String, enum: TitleCasings, required: true },
  captionStyle: { type: String, enum: CaptionStyles, required: true },
  logoCorner: { type: String, enum: LogoCorners, required: true },
  // Storage key of the logo (ws/{id}/brand/…). Logo files are never overwritten, so older videos keep theirs.
  logoKey: { type: String, default: null },
  /** Closing line the AI writes into the last scene; empty = the format's own suggestion. */
  cta: { type: String, default: "", maxlength: 40 },
};

/** Workspace → Brand kit (null until the first save: videos then keep Clipwise's own look). */
export const BrandKitSchema = new Schema(
  {
    ...brandFields,
    showLogo: { type: Boolean, default: true },
    logoName: { type: String, default: null, maxlength: 120 },
    logoBytes: { type: Number, default: null },
  },
  { _id: false },
);

/** Video → the Brand kit as it was when the video was created (logoKey null when the logo was switched off). */
export const VideoBrandSchema = new Schema(brandFields, { _id: false });
