import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts access keys from other services (Instagram) before they're saved, so a database copy alone can't be used
// to post for anyone. AES-256-GCM with TOKEN_ENCRYPTION_KEY (32 random bytes, base64); a changed or wrong key fails
// loudly instead of returning garbage.

const key = () => {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  const bytes = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (bytes.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64 encoded");
  return bytes;
};

export const hasEncryptionKey = () => {
  try {
    key();
    return true;
  } catch {
    return false;
  }
};

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function decryptSecret(sealed: string) {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unknown encrypted value format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
