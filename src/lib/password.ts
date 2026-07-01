import { randomBytes, pbkdf2Sync, scryptSync, timingSafeEqual } from "crypto";

const KEY_LEN = 64;
const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_DIGEST = "sha512";
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, PBKDF2_DIGEST);
  return `pbkdf2:${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

export function verifyPasswordHash(password: string, stored: string): boolean {
  if (stored.startsWith("pbkdf2:")) {
    return verifyPbkdf2(password, stored.slice("pbkdf2:".length));
  }
  return verifyScrypt(password, stored);
}

function verifyPbkdf2(password: string, stored: string): boolean {
  const [saltPart, hashPart] = stored.split(".");
  if (!saltPart || !hashPart) return false;

  try {
    const salt = Buffer.from(saltPart, "base64url");
    const expected = Buffer.from(hashPart, "base64url");
    const actual = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, PBKDF2_DIGEST);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function verifyScrypt(password: string, stored: string): boolean {
  const [saltPart, hashPart] = stored.split(".");
  if (!saltPart || !hashPart) return false;

  try {
    const salt = Buffer.from(saltPart, "base64url");
    const expected = Buffer.from(hashPart, "base64url");
    const actual = scryptSync(password, salt, KEY_LEN, SCRYPT_OPTIONS);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
