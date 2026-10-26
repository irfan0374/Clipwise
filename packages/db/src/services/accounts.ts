import mongoose, { Types } from "mongoose";
import { connectDb } from "../connection";
import { Workspace } from "../models/workspace";
export type AuthAccount = {
  _id: Types.ObjectId | string;
  name: string;
  email: string;
  role?: string;
  suspendedAt?: Date | null;
  createdAt?: Date;
};
/** Better Auth owns these collections; this helper reads only its user metadata, never credentials. */
export async function accountUsers() {
  await connectDb();
  if (!mongoose.connection.db) throw new Error("Database unavailable");
  return mongoose.connection.db.collection<AuthAccount>("user");
}
export const authUserId = (id: string) => (/^[a-f0-9]{24}$/i.test(id) ? new Types.ObjectId(id) : id);
export async function readAccount(id: string) {
  return (await accountUsers()).findOne(
    { _id: authUserId(id) },
    { projection: { name: 1, email: 1, role: 1, suspendedAt: 1, createdAt: 1 } },
  );
}
export class WorkspaceAccessError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor() {
    super("This workspace is suspended or unavailable.");
  }
}
export async function assertWorkspaceActive(id: Types.ObjectId | string) {
  await connectDb();
  const ws = await Workspace.findOne({ _id: id }, { suspendedAt: 1 }).lean();
  if (!ws || ws.suspendedAt) throw new WorkspaceAccessError();
}
