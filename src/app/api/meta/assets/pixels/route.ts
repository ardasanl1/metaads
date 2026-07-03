import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { resolveAdAccountPixels } from "@/lib/meta-pixel-resolver";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim();
    const adAccountId = request.nextUrl.searchParams.get("adAccountId")?.trim();

    if (!connectionId) {
      return jsonError("connectionId gerekli", 400);
    }
    if (!adAccountId) {
      return jsonError("adAccountId gerekli", 400);
    }

    const result = await resolveAdAccountPixels({ connectionId, adAccountId });

    return NextResponse.json({
      success: result.success,
      pixels: result.pixels,
      diagnostic: {
        normalizedAdAccountId: result.diagnostic.normalizedAdAccountId,
        adAccountAccessible: result.diagnostic.adAccountAccessible,
        pixelRequestSucceeded: result.diagnostic.pixelRequestSucceeded,
        resultCount: result.diagnostic.resultCount,
        metaErrorCode: result.diagnostic.metaErrorCode,
        metaErrorType: result.diagnostic.metaErrorType,
        reason: result.diagnostic.reason,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
