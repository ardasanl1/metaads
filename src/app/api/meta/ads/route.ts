import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getAds } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const adSetId = request.nextUrl.searchParams.get("adSetId");
    if (!adSetId) {
      return jsonError("adSetId gerekli", 400);
    }
    const ads = await getAds(adSetId);
    return NextResponse.json({ ads });
  } catch (error) {
    return handleApiError(error);
  }
}
