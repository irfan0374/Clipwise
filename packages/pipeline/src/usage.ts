import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "./env";

const usageFile = path.join(repoRoot, "out/.usage.json");

export type MonthUsage = { elevenLabsCredits: number; elevenLabsCharacters: number; geminiTokens: number; imageRequests: number };

const empty = (): MonthUsage => ({ elevenLabsCredits: 0, elevenLabsCharacters: 0, geminiTokens: 0, imageRequests: 0 });

/** Flash/Turbo models cost about half a credit per character; other models about one. */
export const creditsFor = (characters: number, model: string) => Math.ceil(characters * (/flash|turbo/i.test(model) ? 0.5 : 1));

export const monthUsage = async (): Promise<MonthUsage> => {
  try {
    const all = JSON.parse(await readFile(usageFile, "utf8")) as Record<string, MonthUsage>;
    return { ...empty(), ...all[new Date().toISOString().slice(0, 7)] };
  } catch {
    return empty();
  }
};

/** Adds to this month's running totals in out/.usage.json and returns them. */
export const recordUsage = async (delta: Partial<MonthUsage>): Promise<MonthUsage> => {
  const month = new Date().toISOString().slice(0, 7);
  let all: Record<string, MonthUsage> = {};
  try {
    all = JSON.parse(await readFile(usageFile, "utf8"));
  } catch {}
  const current = { ...empty(), ...all[month] };
  for (const [key, value] of Object.entries(delta)) current[key as keyof MonthUsage] += value ?? 0;
  all[month] = current;
  await mkdir(path.dirname(usageFile), { recursive: true });
  await writeFile(usageFile, JSON.stringify(all, null, 2));
  return current;
};
