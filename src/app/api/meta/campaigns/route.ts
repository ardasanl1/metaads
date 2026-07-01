import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection } from "@/lib/db";
import { createCampaign, getCampaigns } from "@/lib/meta";
import { getInsightsQueryFromRequest } from "@/lib/api-insights";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { parseMetaInsights } from "@/utils/insights";
import type { CampaignWithInsights } from "@/types/meta";
import {
  BUYING_TYPES,
  CAMPAIGN_OBJECTIVES,
  NO_SPECIAL_CATEGORY,
  normalizeSpecialAdCategoriesForApi,
  SPECIAL_AD_CATEGORIES,
  type BuyingType,
  type CampaignObjective,
  type CampaignStatus,
  type SpecialAdCategoryForm,
} from "@/utils/campaign-constants";

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

function isValidSpecialCategory(value: string): value is SpecialAdCategoryForm {
  if (value === NO_SPECIAL_CATEGORY) return true;
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
      return jsonError("Geçerli bir kampanya hedefi seçin", 400);
    }
    if (!body.buyingType || !isValidBuyingType(body.buyingType)) {
      return jsonError("Geçerli bir satın alma türü seçin", 400);
    }

    const rawCategories = body.specialAdCategories ?? [NO_SPECIAL_CATEGORY];
    if (!Array.isArray(rawCategories)) {
      return jsonError("Özel reklam kategorisi gerekli", 400);
    }
    if (!rawCategories.every(isValidSpecialCategory)) {
      return jsonError("Geçersiz özel reklam kategorisi", 400);
    }

    const categories = normalizeSpecialAdCategoriesForApi(rawCategories);

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
