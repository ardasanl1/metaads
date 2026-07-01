import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import {
  getActiveMetaConnection,
  getMetaConnectionById,
  listLinkedAdAccounts,
  updateSelectedAdAccount,
} from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { adAccountIdsMatch, normalizeAdAccountId } from "@/utils/ad-account";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as {
      adAccountId?: string;
      connectionId?: string;
    };

    const adAccountId =
      typeof body.adAccountId === "string" ? normalizeAdAccountId(body.adAccountId.trim()) : "";
    const connectionId =
      typeof body.connectionId === "string" && body.connectionId.trim()
        ? body.connectionId.trim()
        : undefined;

    if (!adAccountId) {
      return jsonError("Reklam hesabı ID gerekli", 400);
    }

    const connection = connectionId
      ? await getMetaConnectionById(connectionId)
      : await getActiveMetaConnection();

    if (!connection) {
      return jsonError("Meta hesabı bağlı değil", 400);
    }

    const linked = await listLinkedAdAccounts(connection.id);
    const account = linked.find((item) => adAccountIdsMatch(item.id, adAccountId));

    if (!account) {
      return jsonError(
        "Bu reklam hesabı firmaya ekli değil. Önce Meta ID ile hesabı ekleyin.",
        400,
      );
    }

    await updateSelectedAdAccount({
      connectionId: connection.id,
      adAccountId: account.id,
      adAccountName: account.name,
    });

    return NextResponse.json({
      ok: true,
      connectionId: connection.id,
      selectedAdAccountId: account.id,
      selectedAdAccountName: account.name,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
