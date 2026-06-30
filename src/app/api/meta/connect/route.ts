import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  isAuthenticatedRequest,
  OAUTH_STATE_COOKIE,
  unauthorizedResponse,
} from "@/lib/auth";
import { buildMetaOAuthUrl, hasMetaConfig } from "@/lib/meta";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    if (!(await hasMetaConfig())) {
      return NextResponse.redirect(
        new URL("/settings/integrations?error=meta-config-missing", request.url),
      );
    }

    const state = randomBytes(24).toString("hex");
    const response = NextResponse.redirect(await buildMetaOAuthUrl(state));
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
