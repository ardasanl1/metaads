import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";
import { runRecipeWizard } from "@/services/meta/meta-creation-orchestrator";
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
      return NextResponse.json({ error: first ?? "Geçersiz istek" }, { status: 400 });
    }

    const result = await runRecipeWizard(body);

    if (process.env.NODE_ENV !== "production" && result.debug) {
      console.info("[wizard/create] debug", JSON.stringify(result.debug, null, 2));
    }
    if (process.env.NODE_ENV !== "production" && result.metaError) {
      console.error("[wizard/create] metaError", result.metaError);
    }

    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
