import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { resolveMetaAssets } from "@/lib/meta-asset-resolver";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim();
    const businessId = request.nextUrl.searchParams.get("businessId")?.trim() || undefined;
    const adAccountId = request.nextUrl.searchParams.get("adAccountId")?.trim();
    const recipeId = request.nextUrl.searchParams.get("recipeId")?.trim();
    const locationQuery = request.nextUrl.searchParams.get("locationQuery")?.trim() || undefined;
    const countryCode = request.nextUrl.searchParams.get("countryCode")?.trim() || undefined;
    const pageId = request.nextUrl.searchParams.get("pageId")?.trim() || undefined;

    if (!connectionId) return jsonError("connectionId gerekli", 400);
    if (!adAccountId) return jsonError("adAccountId gerekli", 400);
    if (!recipeId) return jsonError("recipeId gerekli", 400);

    const assets = await resolveMetaAssets({
      connectionId,
      businessId,
      adAccountId,
      recipeId,
      locationQuery,
      countryCode,
      pageId,
    });

    return NextResponse.json(assets);
  } catch (error) {
    return handleApiError(error);
  }
}
