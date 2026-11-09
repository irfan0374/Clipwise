import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hasEncryptionKey, SocialAccount } from "../src/index";

const newKey = () => randomBytes(32).toString("base64");

describe("secret encryption", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = newKey();
  });

  it("round-trips, with a different result each time", () => {
    const a = encryptSecret("access-token-123");
    const b = encryptSecret("access-token-123");
    expect(a).not.toBe(b);
    expect(a).not.toContain("access-token-123");
    expect(decryptSecret(a)).toBe("access-token-123");
  });

  it("refuses a changed value or another key", () => {
    const sealed = encryptSecret("access-token-123");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
    process.env.TOKEN_ENCRYPTION_KEY = newKey();
    expect(() => decryptSecret(sealed)).toThrow();
  });

  it("needs a 32-byte key", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "short";
    expect(hasEncryptionKey()).toBe(false);
    expect(() => encryptSecret("x")).toThrow(/32 random bytes/);
  });
});

describe("connected accounts", () => {
  const base = {
    workspaceId: "64b7f0c2a1b2c3d4e5f60718",
    platform: "instagram" as const,
    externalId: "1784",
    username: "brand",
    tokenEnc: "v1.a.b.c",
    connectedByUserId: "u1",
  };

  it("never loads the access key unless asked, and keeps one row per account per workspace", async () => {
    await SocialAccount.create(base);
    const plain = await SocialAccount.findOne({ externalId: "1784" }).lean();
    expect(plain?.tokenEnc).toBeUndefined();
    expect((await SocialAccount.findOne({ externalId: "1784" }).select("+tokenEnc").lean())?.tokenEnc).toBe("v1.a.b.c");
    await expect(SocialAccount.create(base)).rejects.toThrow(/duplicate key/);
    await SocialAccount.create({ ...base, workspaceId: "64b7f0c2a1b2c3d4e5f60719" }); // another workspace is fine
  });
});
