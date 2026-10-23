import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "../app/sign-in/auth-forms";

describe("sign-in error messages", () => {
  it("explains the common cases in plain words", () => {
    expect(friendlyAuthError({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" })).toBe("Wrong email or password.");
    expect(friendlyAuthError({ status: 422, code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" })).toMatch(/already exists/);
    expect(friendlyAuthError({ status: 429 })).toMatch(/Too many attempts/);
    expect(friendlyAuthError({ code: "PASSWORD_TOO_SHORT" })).toMatch(/8 characters/);
  });

  it("never shows raw server text", () => {
    expect(friendlyAuthError({ status: 500, message: "MongoServerError: E11000" })).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
