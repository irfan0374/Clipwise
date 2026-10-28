import "server-only";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { connectDb, setUpNewUser } from "@clipwise/db";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI in .env (see .env.example)");

// One client per server process (Next.js hot reload re-imports this module).
const cache = globalThis as typeof globalThis & { __clipwiseAuthMongo?: MongoClient };
if (!cache.__clipwiseAuthMongo)
  cache.__clipwiseAuthMongo = new MongoClient(uri, { maxPoolSize: Number(process.env.MONGODB_MAX_POOL ?? 10) });
const client = cache.__clipwiseAuthMongo;

export const PASSWORD_MIN = 8;

export const auth = betterAuth({
  appName: "Clipwise",
  database: mongodbAdapter(client.db(), { client }),
  // Email + password only. No emails are sent in the beta: no verification, and forgotten
  // passwords are reset by an admin (step G). Add an email provider before the public launch.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refreshed once a day when used
  },
  // Open sign-up: limit account creation and password guessing per IP. Stored in MongoDB so it
  // holds across Vercel's serverless instances.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-up/email": { window: 60 * 60, max: 5 },
      "/sign-in/email": { window: 60, max: 10 },
    },
  },
  advanced: {
    ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user", input: false }, // "user" | "admin"
      suspendedAt: { type: "date", required: false, input: false }, // set by admin (step G)
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Everyone signs up as a normal user (emails aren't verified, so an email can't prove admin).
        // Admins are made with `pnpm user:admin you@example.com` on a machine with database access.
        before: async (user) => ({ data: { ...user, role: "user" } }),
        after: async (user) => {
          await connectDb();
          await setUpNewUser(user);
        },
      },
    },
  },
  plugins: [nextCookies()], // keep last
});

export type Session = typeof auth.$Infer.Session;
