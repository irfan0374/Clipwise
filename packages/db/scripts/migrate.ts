import { readdir } from "node:fs/promises";
import mongoose from "mongoose";
import { runScript } from "./env";

/**
 * Runs each file in packages/db/migrations/ once, in name order (YYYY-MM-DD-what.ts).
 * A migration exports `up(db)`. Applied names are recorded in the _migrations collection.
 */
type Migration = { up: (db: mongoose.mongo.Db) => Promise<void> };

await runScript(async () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("not connected");
  const applied = db.collection<{ name: string; appliedAt: Date }>("_migrations");
  const done = new Set((await applied.find().toArray()).map((m) => m.name));
  const dir = new URL("../migrations/", import.meta.url);
  const files = (await readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.ts$/.test(f)).sort();
  const pending = files.filter((f) => !done.has(f));
  if (!pending.length) return console.log("✓ nothing to migrate");
  for (const file of pending) {
    const { up } = (await import(new URL(file, dir).href)) as Migration;
    console.log(`  → ${file}`);
    await up(db);
    await applied.insertOne({ name: file, appliedAt: new Date() });
  }
  console.log(`✓ applied ${pending.length} migration(s)`);
});
