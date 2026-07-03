import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { saveOAuthMetaConnection, setActiveConnection } from "@/lib/db";
import {
  debugMetaToken,
  exchangeLongLivedUserToken,
  exchangeOAuthCode,
  isOAuthConfigured,
  META_OAUTH_SCOPES,
  verifyOAuthState,
} from "@/lib/meta-oauth";
import { syncMetaConnectionAssets } from "@/lib/meta-asset-sync";
import { resolveTokenIdentity } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";

function appOrigin(request: NextRequest): string {
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  if (!isOAuthConfigured()) {
    return NextResponse.redirect(`${appOrigin(request)}/settings?oauth=missing_config`);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${appOrigin(request)}/settings?oauth=denied`);
  }

  if (!code || !state) {
    return jsonError("OAuth code veya state eksik", 400);
  }

  try {
    verifyOAuthState(state);
    const short = await exchangeOAuthCode(code);
    const longLived = await exchangeLongLivedUserToken(short.accessToken);
    const token = longLived.accessToken;

    const identity = await resolveTokenIdentity(token);
    if (!identity.metaUserId) {
      return NextResponse.redirect(`${appOrigin(request)}/settings?oauth=invalid_token`);
    }

    const debug = await debugMetaToken(token);
    const grantedScopes = debug.scopes?.length ? debug.scopes : [...META_OAUTH_SCOPES];

    const expiresAt =
      longLived.expiresIn && longLived.expiresIn > 0
        ? new Date(Date.now() + longLived.expiresIn * 1000).toISOString()
        : debug.expiresAt
          ? new Date(debug.expiresAt * 1000).toISOString()
          : null;

    const saved = await saveOAuthMetaConnection({
      accessToken: token,
      metaUserId: identity.metaUserId,
      metaUserName: identity.metaUserName,
      grantedScopes,
      tokenExpiresAt: expiresAt,
    });

    await setActiveConnection(saved.id);
    await syncMetaConnectionAssets(saved.id);

    return NextResponse.redirect(`${appOrigin(request)}/settings/meta-setup?connected=1`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return handleApiError(error);
  }
}
