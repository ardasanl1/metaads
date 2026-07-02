import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { createAd, getAds } from "@/lib/meta";
import { getInsightsQueryFromRequest } from "@/lib/api-insights";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { parseMetaInsights } from "@/utils/insights";
import type { AdWithInsights } from "@/types/meta";
import { getMetaConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const adSetId = request.nextUrl.searchParams.get("adSetId");
    if (!adSetId) {
      return jsonError("adSetId gerekli", 400);
    }
    const rawAds = await getAds(adSetId, getInsightsQueryFromRequest(request));
    const ads: AdWithInsights[] = rawAds.map((ad) => ({
      id: ad.id,
      name: ad.name,
      campaign_id: ad.campaign_id,
      adset_id: ad.adset_id,
      status: ad.status,
      effective_status: ad.effective_status,
      created_time: ad.created_time,
      updated_time: ad.updated_time,
      creative: ad.creative,
      insights: ad.insights?.data?.[0] ? parseMetaInsights(ad.insights.data[0]) : null,
    }));
    return NextResponse.json({ ads });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const connection = await getMetaConnection();
    if (!connection?.selectedAdAccountId) {
      return jsonError("Reklam hesabı seçilmedi", 400);
    }

    const body = (await request.json()) as {
      name?: string;
      adSetId?: string;
      creativeId?: string;
      status?: string;
    };

    if (!body.name?.trim()) return jsonError("Reklam adı gerekli", 400);
    if (!body.adSetId?.trim()) return jsonError("adSetId gerekli", 400);
    if (!body.creativeId?.trim()) return jsonError("creativeId gerekli", 400);
    const status = body.status ?? "PAUSED";
    if (status !== "ACTIVE" && status !== "PAUSED") {
      return jsonError("Başlangıç durumu ACTIVE veya PAUSED olmalı", 400);
    }

    const result = await createAd(connection.selectedAdAccountId, {
      name: body.name.trim(),
      adSetId: body.adSetId.trim(),
      creativeId: body.creativeId.trim(),
      status,
    });

    return NextResponse.json({ id: result.id });
  } catch (error) {
    return handleApiError(error);
  }
}
