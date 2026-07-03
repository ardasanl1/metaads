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
    const adAccountId = request.nextUrl.searchParams.get("adAccountId")?.trim() || undefined;
    const businessId = request.nextUrl.searchParams.get("businessId")?.trim() || undefined;

    if (!connectionId) {
      return jsonError("connectionId gerekli", 400);
    }

    const result = await resolveFacebookPages({ connectionId, adAccountId, businessId });

    return NextResponse.json({
      pages: result.pages,
      diagnostics: {
        requestSucceeded: result.success,
        availableCount: result.pages.length,
        totalCount: result.pages.length,
        reason: result.diagnostic.reason,
        detail: result.diagnostic.errors[0]?.message,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
