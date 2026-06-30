import { NextRequest, NextResponse } from "next/server";
import {
  isAuthenticatedRequest,
  OAUTH_STATE_COOKIE,
  unauthorizedResponse,
} from "@/lib/auth";
import { saveMetaConnection } from "@/lib/db";
import {
  exchangeCodeForAccessToken,
  exchangeForLongLivedToken,
  getMetaUserId,
  hasMetaConfig,
} from "@/lib/meta";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  const clearState = (response: NextResponse) => {
    response.cookies.set(OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  };

  if (!code) {
    const response = NextResponse.redirect(
      new URL("/settings/integrations?error=missing_code", request.url),
    );
    return clearState(response);
  }

  if (!state || !storedState || state !== storedState) {
    const response = NextResponse.redirect(
      new URL("/settings/integrations?error=invalid_state", request.url),
    );
    return clearState(response);
  }

  if (!(await hasMetaConfig())) {
    const response = NextResponse.redirect(
      new URL("/settings/integrations?error=meta-config-missing", request.url),
    );
    return clearState(response);
  }

  try {
    const shortToken = await exchangeCodeForAccessToken(code);
    let accessToken = shortToken.access_token;
    let tokenExpiresAt: string | null = null;

    try {
      const longToken = await exchangeForLongLivedToken(accessToken);
      accessToken = longToken.access_token;
      if (longToken.expires_in) {
        tokenExpiresAt = new Date(Date.now() + longToken.expires_in * 1000).toISOString();
      }
    } catch {
      if (shortToken.expires_in) {
        tokenExpiresAt = new Date(Date.now() + shortToken.expires_in * 1000).toISOString();
      }
    }

    const metaUserId = await getMetaUserId(accessToken);
    await saveMetaConnection({ accessToken, tokenExpiresAt, metaUserId });

    const response = NextResponse.redirect(
      new URL("/settings/integrations?connected=1", request.url),
    );
    return clearState(response);
  } catch {
    const response = NextResponse.redirect(
      new URL("/settings/integrations?error=oauth_failed", request.url),
    );
    return clearState(response);
  }
}
