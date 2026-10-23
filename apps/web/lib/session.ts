import "server-only";
import { connectDb, setUpNewUser, Workspace } from "@clipwise/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

/** The signed-in user, or null. Cached per request. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** For signed-in pages: the user and their workspace, or a redirect to sign-in. */
export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  await connectDb();
  let workspace = await Workspace.findOne({ ownerUserId: session.user.id }).lean();
  if (!workspace) {
    // The sign-up hook normally creates it; this covers a hook that failed halfway.
    await setUpNewUser(session.user);
    workspace = await Workspace.findOne({ ownerUserId: session.user.id }).lean();
  }
  if (!workspace) throw new Error(`No workspace for user ${session.user.id}`);
  return { user: session.user, workspace };
});
