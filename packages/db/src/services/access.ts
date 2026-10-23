import { Workspace } from "../models/workspace";

// Account rules, used by Better Auth's hooks (apps/web/lib/auth.ts). Sign-up is open to anyone;
// abuse is limited by the per-IP sign-up limit and per-user/global generation limits.

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Emails listed in ADMIN_EMAILS (comma-separated) get the admin role when they sign up. */
export const adminEmails = (raw = process.env.ADMIN_EMAILS ?? "") =>
  new Set(raw.split(",").map(normalizeEmail).filter(Boolean));

export const roleForEmail = (email: string, admins = adminEmails()): "admin" | "user" =>
  admins.has(normalizeEmail(email)) ? "admin" : "user";

/** Called after a user is created: makes their workspace, exactly once even if the hook runs twice. */
export async function setUpNewUser(user: { id: string; email: string; name?: string | null }): Promise<string> {
  const ws = await Workspace.findOneAndUpdate(
    { ownerUserId: user.id },
    {
      $setOnInsert: {
        ownerUserId: user.id,
        name: (user.name || user.email.split("@")[0] || "My workspace").slice(0, 80),
      },
    },
    { upsert: true, new: true },
  );
  return ws._id.toString();
}
