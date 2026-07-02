import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection, getMetaConnectionById } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { ensureMetaBusinessId, getPixels } from "@/lib/meta";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim() || undefined;
    const connection = connectionId
      ? await getMetaConnectionById(connectionId)
      : await getMetaConnection();
    if (!connection) {
      return jsonError("Meta hesabı bağlı değil", 400);
    }
    if (!connection.selectedAdAccountId) {
      return jsonError("Reklam hesabı seçilmedi", 400);
    }

    const businessId = await ensureMetaBusinessId(connection.id);
    const pixels = await getPixels({
      adAccountId: connection.selectedAdAccountId,
      connectionId: connection.id,
      businessId: businessId ?? undefined,
    });

    if (pixels.length === 0) {
      return jsonError(
        "Pixel bulunamadı. Reklam hesabı veya Business altında tanımlı pixel yok.",
        404,
      );
    }

    return NextResponse.json({ pixels });
  } catch (error) {
    return handleApiError(error);
  }
}
