import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";
import { getFacebookPages, ensureMetaBusinessId } from "@/lib/meta";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim() || undefined;
    const adAccountId = request.nextUrl.searchParams.get("adAccountId")?.trim() || undefined;
    const businessId = connectionId ? await ensureMetaBusinessId(connectionId) : await ensureMetaBusinessId();
    const { pages, diagnostics } = await getFacebookPages({
      connectionId,
      adAccountId,
      businessId: businessId ?? undefined,
    });
    const options = pages.map((p) => ({
      id: p.id,
      name: p.name,
      pictureUrl: p.picture?.data?.url,
      source: "user" as const,
      instagramAccounts: [],
    }));
    return NextResponse.json({ pages: options, diagnostics });
  } catch (error) {
    return handleApiError(error);
  }
}

