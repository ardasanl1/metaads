import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection, getMetaConnectionById } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { ensureMetaBusinessId, getPixelsForAdAccount } from "@/lib/meta";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const connectionIdParam = request.nextUrl.searchParams.get("connectionId")?.trim();
    const adAccountIdParam = request.nextUrl.searchParams.get("adAccountId")?.trim();

    const connection = connectionIdParam
      ? await getMetaConnectionById(connectionIdParam)
      : await getMetaConnection();
    if (!connection) {
      return jsonError("Meta hesabı bağlı değil", 400);
    }

    const adAccountId = adAccountIdParam || connection.selectedAdAccountId;
    if (!adAccountId) {
      return jsonError("Reklam hesabı seçilmedi", 400);
    }

    const businessId = await ensureMetaBusinessId(connection.id);
    const result = await getPixelsForAdAccount({
      adAccountId,
      connectionId: connection.id,
      businessId: businessId ?? undefined,
    });

    return NextResponse.json({
      pixels: result.pixels,
      diagnostics: {
        requestSucceeded: result.requestSucceeded,
        availableCount: result.pixels.filter((pixel) => pixel.available).length,
        totalCount: result.pixels.length,
        reason: result.reason,
        detail: result.detail,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
