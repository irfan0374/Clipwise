import "server-only";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { connectDb, roleForEmail, setUpNewUser } from "@clipwise/db";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI in .env (see .env.example)");

// One client per server process (Next.js hot reload re-imports this module).
const cache = globalThis as typeof globalThis & { __clipwiseAuthMongo?: MongoClient };
if (!cache.__clipwiseAuthMongo) cache.__clipwiseAuthMongo = new MongoClient(uri);
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
        before: async (user) => ({ data: { ...user, role: roleForEmail(user.email) } }),
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
