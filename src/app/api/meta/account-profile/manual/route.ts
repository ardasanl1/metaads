import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { saveManualAdAccountProfile } from "@/lib/ad-account-profile-resolver";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as {
      connectionId?: string;
      businessId?: string;
      adAccountId?: string;
      pageIdOrUrl?: string;
      pixelId?: string;
      websiteUrl?: string;
      instagramId?: string;
    };

    const connectionId = body.connectionId?.trim();
    const adAccountId = body.adAccountId?.trim();
    if (!connectionId) return jsonError("connectionId gerekli", 400);
    if (!adAccountId) return jsonError("adAccountId gerekli", 400);

    const result = await saveManualAdAccountProfile({
      connectionId,
      adAccountId,
      businessId: body.businessId?.trim(),
      pageIdOrUrl: body.pageIdOrUrl?.trim(),
      pixelId: body.pixelId?.trim(),
      websiteUrl: body.websiteUrl?.trim(),
      instagramId: body.instagramId?.trim(),
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
