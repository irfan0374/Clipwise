import { Img, staticFile } from "remotion";
import { useBrand } from "../brand";
import { theme } from "../theme";

// The Brand kit logo in a corner, clear of the Reels / Shorts buttons (top corners sit above the safe zone,
// bottom corners above the caption-free bottom band).
export const Logo = () => {
  const { logo } = useBrand();
  if (!logo) return null;
  const top = logo.corner === "topLeft" || logo.corner === "topRight";
  const left = logo.corner === "topLeft" || logo.corner === "bottomLeft";
  return (
    <Img
      src={logo.src.includes("://") || logo.src.startsWith("blob:") ? logo.src : staticFile(logo.src)}
      style={{
        position: "absolute",
        ...(top ? { top: 96 } : { bottom: theme.safe.bottom + 20 }),
        ...(left ? { left: theme.safe.side } : { right: theme.safe.side }),
        maxWidth: 220,
        maxHeight: 110,
        objectFit: "contain",
        opacity: 0.92,
        filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.35))",
      }}
    />
  );
};
