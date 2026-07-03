import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { resolveFacebookPages } from "@/lib/meta-page-resolver";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim();
    const businessId = request.nextUrl.searchParams.get("businessId")?.trim() || undefined;
    const adAccountId = request.nextUrl.searchParams.get("adAccountId")?.trim() || undefined;

    if (!connectionId) {
      return jsonError("connectionId gerekli", 400);
    }

    const result = await resolveFacebookPages({ connectionId, businessId, adAccountId });

    return NextResponse.json({
      success: result.success,
      pages: result.pages,
      diagnostic: {
        tokenType: result.diagnostic.tokenType,
        userAccountsRequestSucceeded: result.diagnostic.userAccountsRequestSucceeded,
        userAccountsCount: result.diagnostic.userAccountsCount,
        businessOwnedRequestSucceeded: result.diagnostic.businessOwnedRequestSucceeded,
        businessOwnedCount: result.diagnostic.businessOwnedCount,
        businessClientRequestSucceeded: result.diagnostic.businessClientRequestSucceeded,
        businessClientCount: result.diagnostic.businessClientCount,
        missingPermissions: result.diagnostic.missingPermissions,
        reason: result.diagnostic.reason,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
