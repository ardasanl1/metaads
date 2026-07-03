import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { getAdAccountProfile } from "@/lib/ad-account-profile-db";
import { profileSourceLabel as sourceLabel } from "@/utils/profile-source-label";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim();
    const adAccountId = request.nextUrl.searchParams.get("adAccountId")?.trim();
    if (!connectionId) return jsonError("connectionId gerekli", 400);
    if (!adAccountId) return jsonError("adAccountId gerekli", 400);

    const profile = await getAdAccountProfile(connectionId, adAccountId);
    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        page: profile.defaultPageId
          ? {
              id: profile.defaultPageId,
              name: profile.defaultPageName ?? profile.defaultPageId,
              source: profile.pageSource,
              sourceLabel: sourceLabel(profile.pageSource),
              confidence: profile.pageConfidence,
            }
          : null,
        instagram: profile.defaultInstagramId
          ? {
              id: profile.defaultInstagramId,
              username: profile.defaultInstagramUsername,
              source: profile.instagramSource,
              sourceLabel: sourceLabel(profile.instagramSource),
              confidence: profile.instagramConfidence,
            }
          : null,
        pixel: profile.defaultPixelId
          ? {
              id: profile.defaultPixelId,
              name: profile.defaultPixelName ?? profile.defaultPixelId,
              eventType: profile.defaultPixelEventType,
              source: profile.pixelSource,
              sourceLabel: sourceLabel(profile.pixelSource),
              confidence: profile.pixelConfidence,
            }
          : null,
        website: profile.defaultWebsiteUrl
          ? {
              url: profile.defaultWebsiteUrl,
              domain: profile.defaultDomain,
              source: profile.websiteSource,
              sourceLabel: sourceLabel(profile.websiteSource),
              confidence: profile.websiteConfidence,
            }
          : null,
        lastDiscoveredAt: profile.lastDiscoveredAt,
        lastVerifiedAt: profile.lastVerifiedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
