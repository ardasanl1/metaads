import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getAdSets } from "@/lib/meta";
import { getInsightsQueryFromRequest } from "@/lib/api-insights";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { parseMetaInsights } from "@/utils/insights";
import type { AdSetWithInsights } from "@/types/meta";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const campaignId = request.nextUrl.searchParams.get("campaignId");
    if (!campaignId) {
      return jsonError("campaignId gerekli", 400);
    }
    const rawAdsets = await getAdSets(campaignId, getInsightsQueryFromRequest(request));
    const adsets: AdSetWithInsights[] = rawAdsets.map((adset) => ({
      id: adset.id,
      campaign_id: adset.campaign_id,
      name: adset.name,
      status: adset.status,
      effective_status: adset.effective_status,
      daily_budget: adset.daily_budget,
      lifetime_budget: adset.lifetime_budget,
      start_time: adset.start_time,
      end_time: adset.end_time,
      insights: adset.insights?.data?.[0]
        ? parseMetaInsights(adset.insights.data[0])
        : null,
    }));
    return NextResponse.json({ adsets });
  } catch (error) {
    return handleApiError(error);
  }
}
