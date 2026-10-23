// Grants or removes the admin role. Run on a machine with database access (that is the trust check):
//   pnpm user:admin you@example.com            make admin
//   pnpm user:admin you@example.com --remove   back to a normal user
import mongoose from "mongoose";
import { normalizeEmail } from "../src/index";
import { runScript } from "./env";

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const remove = args.includes("--remove");

await runScript(async () => {
  if (!email) throw new Error("usage: pnpm user:admin you@example.com [--remove]");
  const users = mongoose.connection.db?.collection("user");
  if (!users) throw new Error("not connected");
  const role = remove ? "user" : "admin";
  const res = await users.updateOne({ email: normalizeEmail(email) }, { $set: { role } });
  if (!res.matchedCount)
    throw new Error(`No account for ${email}. Create the account in the app first, then run this again.`);
  console.log(
    `✓ ${email} is now ${role === "admin" ? "an admin" : "a normal user"}${res.modifiedCount ? "" : " (no change)"}`,
  );
});
