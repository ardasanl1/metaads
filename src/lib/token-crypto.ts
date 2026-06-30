import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

type EncryptedPayload = {
  iv: string;
  authTag: string;
  encryptedValue: string;
};

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET tanimli degil");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSensitiveValue(value: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encryptedValue = cipher.update(value, "utf8", "base64");
  encryptedValue += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    encryptedValue,
  } satisfies EncryptedPayload);
}

export function decryptSensitiveValue(payload: string): string {
  const parsed = JSON.parse(payload) as Partial<EncryptedPayload> & {
    tag?: string;
    data?: string;
  };
  const iv = parsed.iv;
  const authTag = parsed.authTag ?? parsed.tag;
  const encryptedValue = parsed.encryptedValue ?? parsed.data;

  if (!iv || !authTag || !encryptedValue) {
    throw new Error("Sifreli veri gecersiz");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  let decrypted = decipher.update(encryptedValue, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function encryptToken(token: string): string {
  return encryptSensitiveValue(token);
}

export function decryptToken(payload: string): string {
  return decryptSensitiveValue(payload);
}
