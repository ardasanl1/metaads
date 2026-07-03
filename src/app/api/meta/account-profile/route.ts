import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { getMetaConnectionById } from "@/lib/db";
import { getAdAccountProfile } from "@/lib/ad-account-profile-db";
import {
  listSyncedInstagramAccounts,
  listSyncedPages,
  listSyncedPixels,
} from "@/lib/meta-asset-sync-db";
import { normalizeAdAccountId } from "@/utils/ad-account";
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
      return NextResponse.json({ profile: null, candidates: null });
    }

    const connection = await getMetaConnectionById(connectionId);
    const normalizedAdAccountId = normalizeAdAccountId(adAccountId);
    let candidates = null;

    if (connection?.authMethod === "oauth") {
      const [syncedPages, syncedPixels, syncedInstagram] = await Promise.all([
        listSyncedPages(connectionId),
        listSyncedPixels(connectionId),
        listSyncedInstagramAccounts(connectionId),
      ]);
      const usablePages = syncedPages.filter((p) => p.usability === "DISCOVERED_AND_USABLE");
      const usablePixels = syncedPixels.filter(
        (p) =>
          p.usability === "DISCOVERED_AND_USABLE" &&
          (!p.adAccountId || p.adAccountId === normalizedAdAccountId),
      );
      candidates = {
        pages: usablePages.map((p) => ({
          id: p.metaPageId,
          name: p.name,
          sources: ["direct_user_accounts" as const],
          confidence: 100 as const,
          usageCount: 0,
          usableForAds: true,
        })),
        instagramAccounts: syncedInstagram
          .filter((i) => i.usability === "DISCOVERED_AND_USABLE")
          .map((i) => ({
            id: i.metaInstagramId,
            username: i.username,
            name: i.username ?? i.metaInstagramId,
            pageId: i.pageId,
            sources: ["direct" as const],
            confidence: 100 as const,
          })),
        pixels: usablePixels.map((p) => ({
          id: p.metaPixelId,
          name: p.name,
          sources: ["direct_adspixels" as const],
          confidence: 100 as const,
          eventType: "PURCHASE" as const,
        })),
        websites: profile.defaultWebsiteUrl
          ? [
              {
                url: profile.defaultWebsiteUrl,
                domain: profile.defaultDomain ?? "",
                sources: ["manual" as const],
                confidence: 100 as const,
              },
            ]
          : [],
      };
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
      candidates,
      diagnostics: connection?.authMethod === "oauth"
        ? {
            directPageCount: candidates?.pages.length ?? 0,
            historicalPageCount: 0,
            directPixelCount: candidates?.pixels.length ?? 0,
            historicalPixelCount: 0,
            customConversionPixelCount: 0,
            websiteCount: candidates?.websites.length ?? 0,
            adsScanned: 0,
            adSetsScanned: 0,
            creativesScanned: 0,
            fromCache: true,
            needsManualSetup: [],
          }
        : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
