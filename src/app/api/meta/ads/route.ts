import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getAds } from "@/lib/meta";
import { getInsightsQueryFromRequest } from "@/lib/api-insights";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { parseMetaInsights } from "@/utils/insights";
import type { AdWithInsights } from "@/types/meta";

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
