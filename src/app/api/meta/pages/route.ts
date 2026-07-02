import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";
import { getFacebookPageOptions, ensureMetaBusinessId } from "@/lib/meta";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim() || undefined;
    const adAccountId = request.nextUrl.searchParams.get("adAccountId")?.trim() || undefined;
    const businessId = connectionId
      ? await ensureMetaBusinessId(connectionId, adAccountId)
      : await ensureMetaBusinessId(undefined, adAccountId);
    const { pages, diagnostics } = await getFacebookPageOptions({
      connectionId,
      adAccountId,
      businessId: businessId ?? undefined,
    });
    return NextResponse.json({ pages, diagnostics });
  } catch (error) {
    return handleApiError(error);
  }
}
