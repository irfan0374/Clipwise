import { theme } from "../theme";

export const Label = ({
  text,
  width,
  size = 40,
  style,
}: {
  text?: string;
  width: number;
  size?: number;
  style?: React.CSSProperties;
}) =>
  text ? (
    <div
      style={{
        width,
        textAlign: "center",
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.12,
        color: theme.text,
        letterSpacing: -0.5,
        ...style,
      }}
    >
      {text}
    </div>
  ) : null;
