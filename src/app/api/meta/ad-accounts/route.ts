import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import {
  addLinkedAdAccount,
  getActiveMetaConnection,
  getMetaConnectionById,
  listLinkedAdAccounts,
} from "@/lib/db";
import { MetaApiError, verifyMetaConnection } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { normalizeAdAccountId } from "@/utils/ad-account";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId");

    const connection = connectionId
      ? await getMetaConnectionById(connectionId)
      : await getActiveMetaConnection();

    if (!connection) {
      return jsonError("Meta hesabı bağlı değil", 400);
    }

    const linked = await listLinkedAdAccounts(connection.id);

    return NextResponse.json({
      adAccounts: linked.map((account) => ({
        id: account.id,
        accountId: account.accountId,
        name: account.name,
        connectionId: connection.id,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

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
      return jsonError("Reklam hesabı ID gerekli (ör. act_123456789)", 400);
    }

    const connection = connectionId
      ? await getMetaConnectionById(connectionId)
      : await getActiveMetaConnection();

    if (!connection) {
      return jsonError("Meta hesabı bağlı değil", 400);
    }

    const verified = await verifyMetaConnection(connection.accessToken, adAccountId);

    const result = await addLinkedAdAccount({
      connectionId: connection.id,
      adAccountId: verified.adAccountId,
      adAccountName: verified.accountName,
      select: true,
    });

    return NextResponse.json({
      ok: true,
      connectionId: connection.id,
      adAccounts: result.linkedAdAccounts.map((account) => ({
        id: account.id,
        accountId: account.accountId,
        name: account.name,
        connectionId: connection.id,
      })),
      selectedAdAccountId: result.selectedAdAccountId,
      selectedAdAccountName: result.selectedAdAccountName,
    });
  } catch (error) {
    if (error instanceof MetaApiError) {
      return jsonError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
