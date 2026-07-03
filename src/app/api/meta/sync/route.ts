import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnectionById } from "@/lib/db";
import { syncMetaConnectionAssets } from "@/lib/meta-asset-sync";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as { connectionId?: string };
    const connectionId = body.connectionId?.trim();
    if (!connectionId) return jsonError("connectionId gerekli", 400);

    const connection = await getMetaConnectionById(connectionId);
    if (!connection) return jsonError("Baglanti bulunamadi", 404);

    const report = await syncMetaConnectionAssets(connectionId);
    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}
