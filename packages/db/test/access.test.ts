import { describe, expect, it } from "vitest";
import { roleForEmail, setUpNewUser, Workspace } from "../src/index";

describe("roles", () => {
  it("makes ADMIN_EMAILS admins, case-insensitive, and everyone else a user", () => {
    const admins = new Set(["boss@example.com"]);
    expect(roleForEmail(" Boss@Example.com", admins)).toBe("admin");
    expect(roleForEmail("sam@example.com", admins)).toBe("user");
  });
});

describe("new user setup", () => {
  it("creates one workspace even if called twice", async () => {
    const user = { id: "user_sam", email: "Sam@example.com", name: "Sam Lee" };
    const a = await setUpNewUser(user);
    const b = await setUpNewUser(user);
    expect(a).toBe(b);
    expect(await Workspace.countDocuments({ ownerUserId: "user_sam" })).toBe(1);
    expect((await Workspace.findById(a))?.name).toBe("Sam Lee");
  });

  it("names the workspace after the email when there is no name", async () => {
    const id = await setUpNewUser({ id: "user_x", email: "maya@example.com", name: "" });
    expect((await Workspace.findById(id))?.name).toBe("maya");
  });
});
