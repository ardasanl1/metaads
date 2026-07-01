import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection } from "@/lib/db";
import { getAccountInsights } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { parseMetaInsights } from "@/utils/insights";

function getInsightsQuery(request: NextRequest) {
  const datePreset = request.nextUrl.searchParams.get("datePreset") ?? undefined;
  const since = request.nextUrl.searchParams.get("since") ?? undefined;
  const until = request.nextUrl.searchParams.get("until") ?? undefined;
  return { datePreset, since, until };
}

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connection = await getMetaConnection();
    if (!connection?.selectedAdAccountId) {
      return jsonError("Reklam hesabı seçilmedi", 400);
    }

    const raw = await getAccountInsights(connection.selectedAdAccountId, getInsightsQuery(request));
    return NextResponse.json({ insights: parseMetaInsights(raw) });
  } catch (error) {
    return handleApiError(error);
  }
}
