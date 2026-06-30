import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "panel_session";
export const OAUTH_STATE_COOKIE = "meta_oauth_state";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET tanımlı değil");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export function createSessionCookie(): string {
  const payload = Buffer.from(
    JSON.stringify({ iat: Date.now() }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  try {
    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      iat: number;
    };
    const age = Date.now() - data.iat;
    return age >= 0 && age <= SESSION_MAX_AGE * 1000;
  } catch {
    return false;
  }
}

export function verifyPassword(password: string): boolean {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(appPassword);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export function isAuthenticatedRequest(request: NextRequest): boolean {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, createSessionCookie(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
}
