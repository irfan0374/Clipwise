import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import mongoose from "mongoose";
import { dbName } from "../src/connection";
import { isProductionDb, repoRoot, runScript } from "./env";

/**
 * Database backup and restore. The free Atlas cluster (M0) has no backups of its own.
 *
 *   pnpm db:backup                       → backups/<database>-<date>/ (one .jsonl.gz file per collection)
 *   pnpm db:restore backups/<folder>     → loads a backup into the database in MONGODB_URI
 *
 * Extended JSON keeps ids, dates and binary data exact. Restore refuses a database that already has data unless
 * --replace is given, and refuses production unless --production is given too. Backups hold personal data
 * (emails, password hashes, sessions): the backups/ folder is git-ignored; keep copies somewhere private.
 */
const { EJSON } = mongoose.mongo.BSON;
const [command, folderArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));

await runScript(async () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("not connected");
  const name = dbName() ?? "unknown";

  if (command === "backup") {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const folder = path.join(repoRoot, "backups", `${name}-${stamp}`);
    await mkdir(folder, { recursive: true });
    const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((c) => c.name)
      .filter((c) => !c.startsWith("system."));
    let total = 0;
    for (const collection of collections) {
      const lines: string[] = [];
      for await (const doc of db.collection(collection).find()) lines.push(EJSON.stringify(doc, { relaxed: false }));
      await writeFile(path.join(folder, `${collection}.jsonl.gz`), gzipSync(lines.join("\n")));
      total += lines.length;
      console.log(`  ${collection}: ${lines.length}`);
    }
    console.log(`✓ ${total} documents in ${collections.length} collections → ${path.relative(repoRoot, folder)}`);
    return;
  }

  if (command === "restore") {
    if (!folderArg) throw new Error("say which backup: pnpm db:restore backups/<folder>");
    if (isProductionDb(name) && !flags.has("--production"))
      throw new Error(`refusing to restore into the production database "${name}" (add --production to confirm)`);
    const folder = path.resolve(repoRoot, folderArg);
    const files = (await readdir(folder)).filter((f) => f.endsWith(".jsonl.gz"));
    if (!files.length) throw new Error(`no backup files in ${folderArg}`);
    const existing = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    const nonEmpty: string[] = [];
    for (const c of existing)
      if (!c.startsWith("system.") && (await db.collection(c).estimatedDocumentCount())) nonEmpty.push(c);
    if (nonEmpty.length && !flags.has("--replace"))
      throw new Error(`"${name}" already has data (${nonEmpty.join(", ")}). Add --replace to overwrite it.`);
    for (const file of files) {
      const collection = file.replace(/\.jsonl\.gz$/, "");
      const text = gunzipSync(await readFile(path.join(folder, file))).toString("utf8");
      const docs = text ? text.split("\n").map((line) => EJSON.parse(line, { relaxed: false })) : [];
      await db.collection(collection).deleteMany({});
      if (docs.length) await db.collection(collection).insertMany(docs as never[]);
      console.log(`  ${collection}: ${docs.length}`);
    }
    console.log(`✓ restored ${files.length} collections into "${name}". Run pnpm db:indexes next.`);
    return;
  }

  throw new Error("usage: pnpm db:backup  |  pnpm db:restore backups/<folder> [--replace] [--production]");
});
