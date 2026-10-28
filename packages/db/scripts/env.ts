import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { connectDb, dbName, disconnectDb } from "../src/index";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
// `.env` locally; CLIPWISE_ENV=staging / live uses `.env.staging` / `.env.live` (e.g. `CLIPWISE_ENV=live pnpm user:admin …`).
const envName = process.env.CLIPWISE_ENV;
config({ path: path.join(repoRoot, envName ? `.env.${envName}` : ".env"), quiet: true });

/** Production's database is named exactly "clipwise"; dev is clipwise_dev, staging clipwise_staging. */
export const isProductionDb = (name: string | null) => name === "clipwise" || process.env.NODE_ENV === "production";

/** Connects (indexes off — `db:indexes` owns them), runs the task, always disconnects. */
export const runScript = async (task: () => Promise<void>) => {
  try {
    await connectDb({ autoIndex: false });
    console.log(`database: ${dbName()}`);
    await task();
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  } finally {
    await disconnectDb();
  }
};
