import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { invalidateSnapshotCache } from "@/lib/account-snapshot-cache";
import { fetchAccountSnapshot } from "@/services/meta/account-snapshot";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const params = request.nextUrl.searchParams;
    const connectionId = params.get("connectionId")?.trim();
    const adAccountId = params.get("adAccountId")?.trim();
    const recipeId = params.get("recipeId")?.trim();
    const businessId = params.get("businessId")?.trim() || undefined;
    const pageId = params.get("pageId")?.trim() || undefined;
    const refresh = params.get("refresh") === "1";

    if (!connectionId || !adAccountId || !recipeId) {
      return jsonError("connectionId, adAccountId ve recipeId gerekli", 400);
    }

    if (refresh) {
      invalidateSnapshotCache({ connectionId, businessId, adAccountId, recipeId });
    }

    const snapshot = await fetchAccountSnapshot({
      connectionId,
      businessId,
      adAccountId,
      recipeId,
      pageId,
      refresh,
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    return handleApiError(error);
  }
}
