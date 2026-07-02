import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { runWebsiteSalesWizard } from "@/services/meta/campaign-orchestrator";
import { validateWebsiteSalesSubmit } from "@/utils/campaign-wizard-validation";
import type { WebsiteSalesSubmit } from "@/types/campaign-wizard";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as WebsiteSalesSubmit;
    const submitErrors = validateWebsiteSalesSubmit({ imageHash: body.imageHash });
    if (submitErrors.imageHash) {
      return jsonError(submitErrors.imageHash, 400);
    }

    const result = await runWebsiteSalesWizard(body);
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}

