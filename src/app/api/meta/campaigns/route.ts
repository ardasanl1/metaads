import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection } from "@/lib/db";
import { getCampaigns } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const connection = await getMetaConnection();
    if (!connection?.selectedAdAccountId) {
      return jsonError("Reklam hesabı seçilmedi", 400);
    }
    const campaigns = await getCampaigns(connection.selectedAdAccountId);
    return NextResponse.json({ campaigns });
  } catch (error) {
    return handleApiError(error);
  }
}
