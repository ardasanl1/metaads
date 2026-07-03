import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { discoverAdAccountProfile } from "@/lib/ad-account-profile-resolver";
import { getRecipeRequiredAssets } from "@/config/campaign-recipes";
import type { CampaignRecipeId } from "@/config/campaign-recipes";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as {
      connectionId?: string;
      businessId?: string;
      adAccountId?: string;
      forceRefresh?: boolean;
      recipeId?: string;
    };

    const connectionId = body.connectionId?.trim();
    const adAccountId = body.adAccountId?.trim();
    if (!connectionId) return jsonError("connectionId gerekli", 400);
    if (!adAccountId) return jsonError("adAccountId gerekli", 400);

    const required = body.recipeId
      ? getRecipeRequiredAssets(body.recipeId as CampaignRecipeId)
      : ["page", "pixel"];

    const result = await discoverAdAccountProfile({
      connectionId,
      businessId: body.businessId?.trim(),
      adAccountId,
      forceRefresh: body.forceRefresh,
      needsPage: required.some((a) => ["page", "instagram", "instantForm", "whatsapp"].includes(a)),
      needsPixel: required.includes("pixel"),
      needsWebsite: true,
      needsInstagram: required.includes("instagram"),
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
