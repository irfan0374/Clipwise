import { Workspace } from "../models/workspace";

// Account rules, used by Better Auth's hooks (apps/web/lib/auth.ts). Sign-up is open to anyone and always
// creates a normal user; the admin role is granted only by `pnpm user:admin` (scripts/user-admin.ts).

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

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
    { upsert: true, returnDocument: "after" },
  );
  return ws._id.toString();
}
