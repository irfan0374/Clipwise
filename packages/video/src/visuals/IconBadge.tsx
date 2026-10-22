import { iconComponent } from "./icons";

/** A round badge: tinted fill, coloured ring, icon in the middle. */
export const IconBadge = ({
  icon,
  size,
  color,
  filled = false,
  style,
}: {
  icon: string | undefined;
  size: number;
  color: string;
  filled?: boolean;
  style?: React.CSSProperties;
}) => {
  const Icon = iconComponent(icon);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: filled ? color : `${color}26`,
        border: `${Math.max(3, size / 40)}px solid ${color}`,
        boxShadow: `0 0 ${size / 3}px ${color}55`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <Icon size={size * 0.5} color={filled ? "#0B0B0F" : color} strokeWidth={1.75} />
    </div>
  );
};
