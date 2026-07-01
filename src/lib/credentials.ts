import { timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyCredentials(email: string, password: string): boolean {
  const appEmail = process.env.APP_EMAIL?.trim();
  const appPassword = process.env.APP_PASSWORD?.trim();
  if (!appEmail || !appPassword) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const expectedEmail = appEmail.toLowerCase();
  if (normalizedEmail !== expectedEmail) return false;

  return safeCompare(password, appPassword);
}

export function hasCredentialEnv(): boolean {
  return Boolean(process.env.APP_EMAIL?.trim() && process.env.APP_PASSWORD?.trim());
}
