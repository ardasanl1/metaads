import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { fetchPageBoundSnapshotAssets } from "@/services/meta/account-snapshot";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const params = request.nextUrl.searchParams;
    const connectionId = params.get("connectionId")?.trim();
    const recipeId = params.get("recipeId")?.trim();
    const pageId = params.get("pageId")?.trim();
    const pageName = params.get("pageName")?.trim() || undefined;

    if (!connectionId || !recipeId || !pageId) {
      return jsonError("connectionId, recipeId ve pageId gerekli", 400);
    }

    const assets = await fetchPageBoundSnapshotAssets({
      connectionId,
      recipeId,
      pageId,
      pageName,
    });

    return NextResponse.json(assets);
  } catch (error) {
    return handleApiError(error);
  }
}
