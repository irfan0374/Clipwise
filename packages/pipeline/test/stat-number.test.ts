import { describe, expect, it } from "vitest";
import { formatStat, parseStat } from "../../video/src/templates/stat-number";

const final = (v: string) => {
  const p = parseStat(v);
  return p ? formatStat(p, 1) : v;
};

describe("stat numbers", () => {
  it("keeps thousands as thousands", () => {
    expect(parseStat("1,000")?.number).toBe(1000);
    expect(final("1,000")).toBe("1,000");
    expect(final("12,500,000+")).toBe("12,500,000+");
    expect(final("$1,250.50")).toBe("$1,250.50");
  });

  it("still handles decimals, prefixes and suffixes", () => {
    expect(final("~5x")).toBe("~5x");
    expect(final("2.5B")).toBe("2.5B");
    expect(final("99%")).toBe("99%");
    expect(parseStat("1,5")?.number).toBe(1.5); // European decimal
  });

  it("counts up with the same format", () => {
    const p = parseStat("1,000")!;
    expect(formatStat(p, 0.5)).toBe("500");
    expect(formatStat(parseStat("12,000")!, 0.5)).toBe("6,000");
  });
});
