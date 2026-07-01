import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection, updateSelectedAdAccount } from "@/lib/db";
import { MetaApiError, normalizeAdAccountId, verifyMetaConnection } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connection = await getMetaConnection();
    if (!connection) {
      return jsonError("Meta hesabı bağlı değil", 400);
    }

    const body = (await request.json()) as {
      adAccountId?: string;
      adAccountName?: string;
    };

    const adAccountId =
      typeof body.adAccountId === "string" ? normalizeAdAccountId(body.adAccountId) : "";
    const adAccountName = typeof body.adAccountName === "string" ? body.adAccountName.trim() : "";

    if (!adAccountId) {
      return jsonError("Reklam hesabı ID gerekli", 400);
    }

    let accountName = adAccountName;
    if (!accountName) {
      const verified = await verifyMetaConnection(connection.accessToken, adAccountId);
      accountName = verified.accountName;
    }

    await updateSelectedAdAccount({
      adAccountId,
      adAccountName: accountName,
    });

    return NextResponse.json({
      ok: true,
      selectedAdAccountId: adAccountId,
      selectedAdAccountName: accountName,
    });
  } catch (error) {
    if (error instanceof MetaApiError) {
      return jsonError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
