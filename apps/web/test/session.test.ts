import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  account: { name: "Member", role: "user", suspendedAt: null as Date | null } as {
    name: string;
    role: string;
    suspendedAt: Date | null;
  } | null,
  workspace: { suspendedAt: null as Date | null },
  session: true,
}));
vi.mock("server-only", () => ({}));
// React cache is request-local in Next; each invocation here represents a fresh request.
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: async () => (state.session ? { user: { id: "member", name: "Stale", role: "admin" } } : null) },
  },
}));
vi.mock("@clipwise/db", () => ({
  connectDb: async () => {},
  setUpNewUser: vi.fn(),
  readAccount: async () => state.account,
  Workspace: { findOne: () => ({ lean: async () => state.workspace }) },
}));

import { getSession, requireUser } from "../lib/session";

beforeEach(() => {
  state.session = true;
  state.account = { name: "Member", role: "user", suspendedAt: null };
  state.workspace = { suspendedAt: null };
});
describe("fresh access checks", () => {
  it("uses the current stored role instead of an old admin session role", async () => {
    expect((await getSession())?.user.role).toBe("user");
    state.account!.role = "admin";
    expect((await getSession())?.user.role).toBe("admin");
    state.account!.role = "user";
    expect((await getSession())?.user.role).toBe("user");
  });
  it("blocks an existing session immediately when its workspace is suspended", async () => {
    state.workspace.suspendedAt = new Date();
    await expect(requireUser()).rejects.toThrow("redirect:/suspended");
    state.workspace.suspendedAt = null;
    expect((await requireUser()).user.id).toBe("member");
  });
  it("does not trust a cookie when the underlying account was removed", async () => {
    state.account = null;
    expect(await getSession()).toBeNull();
    await expect(requireUser()).rejects.toThrow("redirect:/sign-in");
  });
});
