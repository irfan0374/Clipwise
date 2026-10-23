/**
 * Splits a stat like "~5x", "1,000+", "$2.5B" or "99%" into prefix, number and suffix so it can count up.
 * "1,000" / "12,500,000" are thousands (commas kept when shown); "1,5" (one comma, not 3 digits after) is a
 * European decimal.
 */
export const parseStat = (value: string) => {
  const match = value.match(/^(\D*?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)(.*)$/);
  if (!match) return null;
  const digits = match[2]!;
  const grouped = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(digits);
  const raw = grouped ? digits.replaceAll(",", "") : digits.replace(",", ".");
  return {
    prefix: match[1]!,
    number: Number(raw),
    decimals: raw.split(".")[1]?.length ?? 0,
    grouped,
    suffix: match[3]!,
  };
};

/** The stat at `progress` (0–1) of its count-up, formatted like the original. */
export const formatStat = (stat: NonNullable<ReturnType<typeof parseStat>>, progress: number) => {
  const n = stat.number * progress;
  const text = stat.grouped
    ? n.toLocaleString("en-US", { minimumFractionDigits: stat.decimals, maximumFractionDigits: stat.decimals })
    : n.toFixed(stat.decimals);
  return `${stat.prefix}${text}${stat.suffix}`;
};
