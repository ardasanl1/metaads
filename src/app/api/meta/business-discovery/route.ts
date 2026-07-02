import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnectionById } from "@/lib/db";
import { discoverBusinessForAdAccount } from "@/lib/meta-business-discovery";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { normalizeAdAccountId } from "@/utils/ad-account";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim();
    const adAccountIdParam = request.nextUrl.searchParams.get("adAccountId")?.trim();

    if (!connectionId) return jsonError("connectionId gerekli", 400);
    if (!adAccountIdParam) return jsonError("adAccountId gerekli", 400);

    const connection = await getMetaConnectionById(connectionId);
    if (!connection) return jsonError("Bağlantı bulunamadı", 404);

    const adAccountId = normalizeAdAccountId(adAccountIdParam);
    if (!adAccountId) return jsonError("adAccountId geçersiz", 400);

    const result = await discoverBusinessForAdAccount({ connectionId, adAccountId });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
