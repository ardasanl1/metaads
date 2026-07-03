import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { buildMetaOAuthUrl, isOAuthConfigured } from "@/lib/meta-oauth";
import { jsonError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  if (!isOAuthConfigured()) {
    return jsonError("META_APP_ID, META_APP_SECRET ve META_REDIRECT_URI tanimli olmali", 503);
  }

  const reauthorize = request.nextUrl.searchParams.get("reauthorize") === "1";
  const url = buildMetaOAuthUrl({ reauthorize });
  return NextResponse.redirect(url);
}
