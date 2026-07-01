import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection, saveMetaConnection } from "@/lib/db";
import { MetaApiError, normalizeAdAccountId, verifyMetaConnection, verifyMetaToken } from "@/lib/meta";
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

    const existing = await getMetaConnection();
    const normalizedAccountId = adAccountId ? normalizeAdAccountId(adAccountId) : "";

    if (normalizedAccountId) {
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
    }

    const verified = await verifyMetaToken(accessToken);
    if (!verified.metaUserId) {
      return jsonError("Access Token gecersiz. Token ve izinleri kontrol edin.", 400);
    }

    await saveMetaConnection({
      accessToken,
      adAccountId: existing?.selectedAdAccountId ?? "",
      adAccountName: existing?.selectedAdAccountName ?? "",
      metaUserId: verified.metaUserId,
    });

    return NextResponse.json({
      ok: true,
      connected: true,
      selectedAdAccountId: existing?.selectedAdAccountId || null,
      selectedAdAccountName: existing?.selectedAdAccountName || null,
      metaUserId: verified.metaUserId,
    });
  } catch (error) {
    if (error instanceof MetaApiError) {
      return jsonError("Token gecersiz. Bilgileri kontrol edin.", error.status);
    }
    return handleApiError(error);
  }
}
