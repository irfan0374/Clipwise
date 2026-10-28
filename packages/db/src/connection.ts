import mongoose from "mongoose";

// Cached on globalThis so Next.js hot reloads and serverless re-invocations reuse one connection.
const cache = globalThis as typeof globalThis & { __clipwiseDb?: Promise<typeof mongoose> };

export type ConnectOptions = {
  /** Defaults to MONGODB_URI. */
  uri?: string;
  /** Build indexes on startup. Off in production, where `pnpm db:indexes` creates them. */
  autoIndex?: boolean;
};

export const connectDb = (opts: ConnectOptions = {}) => {
  const uri = opts.uri ?? process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in .env (see .env.example)");
  cache.__clipwiseDb ??= mongoose
    .connect(uri, {
      autoIndex: opts.autoIndex ?? process.env.NODE_ENV !== "production",
      serverSelectionTimeoutMS: 10_000,
      // Serverless hosting starts many small copies of the web app; keep each one's pool small so the free
      // Atlas cluster's connection limit (500) is never reached.
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL ?? 10),
    })
    .catch((err: unknown) => {
      cache.__clipwiseDb = undefined; // let the next call retry
      throw err;
    });
  return cache.__clipwiseDb;
};

export const disconnectDb = async () => {
  if (!cache.__clipwiseDb) return;
  cache.__clipwiseDb = undefined;
  await mongoose.disconnect();
};

/** The database name in the URI, e.g. `clipwise_dev`. */
export const dbName = () => mongoose.connection.db?.databaseName ?? null;
