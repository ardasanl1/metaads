import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { ensureMetaBusinessId, getMetaAssetDiagnostics } from "@/lib/meta";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim();
    const businessIdParam = request.nextUrl.searchParams.get("businessId")?.trim();
    const adAccountId = request.nextUrl.searchParams.get("adAccountId")?.trim();
    const pageId = request.nextUrl.searchParams.get("pageId")?.trim() || undefined;
    const locationQuery = request.nextUrl.searchParams.get("locationQuery")?.trim() || undefined;
    const countryCode = request.nextUrl.searchParams.get("countryCode")?.trim() || undefined;

    if (!connectionId) return jsonError("connectionId gerekli", 400);
    if (!adAccountId) return jsonError("adAccountId gerekli", 400);

    const businessId =
      businessIdParam || (await ensureMetaBusinessId(connectionId)) || undefined;

    const diagnostics = await getMetaAssetDiagnostics({
      connectionId,
      businessId,
      adAccountId,
      pageId,
      locationQuery,
      countryCode,
    });

    return NextResponse.json({ diagnostics });
  } catch (error) {
    return handleApiError(error);
  }
}
