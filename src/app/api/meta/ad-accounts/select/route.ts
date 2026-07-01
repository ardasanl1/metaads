import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection, updateSelectedAdAccount } from "@/lib/db";
import { MetaApiError, verifyMetaConnection } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { normalizeAdAccountId } from "@/utils/ad-account";

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

    const verified = await verifyMetaConnection(connection.accessToken, adAccountId);

    await updateSelectedAdAccount({
      adAccountId: verified.adAccountId,
      adAccountName: adAccountName || verified.accountName,
    });

    return NextResponse.json({
      ok: true,
      selectedAdAccountId: verified.adAccountId,
      selectedAdAccountName: adAccountName || verified.accountName,
    });
  } catch (error) {
    if (error instanceof MetaApiError) {
      return jsonError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
