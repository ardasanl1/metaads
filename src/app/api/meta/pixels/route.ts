import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { getPixels } from "@/lib/meta";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const connection = await getMetaConnection();
    if (!connection?.selectedAdAccountId) {
      return jsonError("Reklam hesabı seçilmedi", 400);
    }
    const pixels = await getPixels(connection.selectedAdAccountId);
    return NextResponse.json({ pixels });
  } catch (error) {
    return handleApiError(error);
  }
}

