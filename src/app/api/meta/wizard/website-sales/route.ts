import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { createFullAdCampaignPlan } from "@/services/meta/meta-creation-orchestrator";
import { validateCampaignSubmit } from "@/utils/campaign-wizard-validation";
import type { CampaignSubmit } from "@/types/campaign-wizard";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as CampaignSubmit;
    const submitErrors = validateCampaignSubmit(body);
    if (Object.keys(submitErrors).length > 0) {
      const first = Object.values(submitErrors).find(Boolean);
      return jsonError(first ?? "Geçersiz istek", 400);
    }

    const result = await createFullAdCampaignPlan(body);
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}

