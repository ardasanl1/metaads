import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { saveMetaConnection } from "@/lib/db";
import { MetaApiError, normalizeAdAccountId, verifyMetaConnection } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as {
      accessToken?: string;
      adAccountId?: string;
    };

    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
    const adAccountId = typeof body.adAccountId === "string" ? body.adAccountId.trim() : "";

    if (!accessToken) {
      return jsonError("Meta Access Token gerekli", 400);
    }
    if (!adAccountId) {
      return jsonError("Reklam hesabi ID gerekli", 400);
    }

    const normalizedAccountId = normalizeAdAccountId(adAccountId);
    const verified = await verifyMetaConnection(accessToken, normalizedAccountId);

    await saveMetaConnection({
      accessToken,
      adAccountId: normalizedAccountId,
      adAccountName: verified.accountName,
      metaUserId: verified.metaUserId,
    });

    return NextResponse.json({
      ok: true,
      connected: true,
      selectedAdAccountId: normalizedAccountId,
      selectedAdAccountName: verified.accountName,
      metaUserId: verified.metaUserId,
    });
  } catch (error) {
    if (error instanceof MetaApiError) {
      return jsonError("Token veya reklam hesabi gecersiz. Bilgileri kontrol edin.", error.status);
    }
    return handleApiError(error);
  }
}
