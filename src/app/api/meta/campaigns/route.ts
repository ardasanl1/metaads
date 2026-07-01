import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection } from "@/lib/db";
import { createCampaign, getCampaigns } from "@/lib/meta";
import { getInsightsQueryFromRequest } from "@/lib/api-insights";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { parseMetaInsights } from "@/utils/insights";
import type { CampaignWithInsights } from "@/types/meta";
import type { BuyingType, CampaignObjective, CampaignStatus, SpecialAdCategory } from "@/utils/campaign-constants";
import { BUYING_TYPES, CAMPAIGN_OBJECTIVES, SPECIAL_AD_CATEGORIES } from "@/utils/campaign-constants";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connection = await getMetaConnection();
    if (!connection?.selectedAdAccountId) {
      return jsonError("Reklam hesabı seçilmedi", 400);
    }

    const rawCampaigns = await getCampaigns(
      connection.selectedAdAccountId,
      getInsightsQueryFromRequest(request),
    );

    const campaigns: CampaignWithInsights[] = rawCampaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      effective_status: campaign.effective_status,
      created_time: campaign.created_time,
      updated_time: campaign.updated_time,
      daily_budget: campaign.daily_budget,
      lifetime_budget: campaign.lifetime_budget,
      insights: parseMetaInsights(campaign.insights?.data?.[0]),
    }));

    return NextResponse.json({ campaigns });
  } catch (error) {
    return handleApiError(error);
  }
}

function isValidObjective(value: string): value is CampaignObjective {
  return CAMPAIGN_OBJECTIVES.some((item) => item.value === value);
}

function isValidBuyingType(value: string): value is BuyingType {
  return BUYING_TYPES.some((item) => item.value === value);
}

function isValidSpecialCategory(value: string): value is SpecialAdCategory {
  return SPECIAL_AD_CATEGORIES.some((item) => item.value === value);
}

function isValidStatus(value: string): value is CampaignStatus {
  return value === "ACTIVE" || value === "PAUSED";
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
      objective?: string;
      buyingType?: string;
      specialAdCategories?: string[];
      status?: string;
    };

    if (!body.name?.trim()) {
      return jsonError("Kampanya adı gerekli", 400);
    }
    if (!body.objective || !isValidObjective(body.objective)) {
      return jsonError("Geçerli bir objective seçin", 400);
    }
    if (!body.buyingType || !isValidBuyingType(body.buyingType)) {
      return jsonError("Geçerli bir buying type seçin", 400);
    }

    const categories = body.specialAdCategories ?? ["NONE"];
    if (!Array.isArray(categories) || categories.length === 0) {
      return jsonError("Special ad categories gerekli", 400);
    }
    if (!categories.every(isValidSpecialCategory)) {
      return jsonError("Geçersiz special ad category", 400);
    }

    const status = body.status ?? "PAUSED";
    if (!isValidStatus(status)) {
      return jsonError("Başlangıç durumu ACTIVE veya PAUSED olmalı", 400);
    }

    const result = await createCampaign(connection.selectedAdAccountId, {
      name: body.name.trim(),
      objective: body.objective,
      buyingType: body.buyingType,
      specialAdCategories: categories,
      status,
    });

    return NextResponse.json({ id: result.id });
  } catch (error) {
    return handleApiError(error);
  }
}
