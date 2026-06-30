import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getAdSets } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const campaignId = request.nextUrl.searchParams.get("campaignId");
    if (!campaignId) {
      return jsonError("campaignId gerekli", 400);
    }
    const adsets = await getAdSets(campaignId);
    return NextResponse.json({ adsets });
  } catch (error) {
    return handleApiError(error);
  }
}
