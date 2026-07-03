import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import {
  addLinkedAdAccount,
  getMetaConnectionById,
  setOnboardingCompleted,
  updateMetaBusinessProfile,
  updateSelectedAdAccount,
} from "@/lib/db";
import { upsertAdAccountProfile } from "@/lib/ad-account-profile-db";
import { syncMetaConnectionAssets } from "@/lib/meta-asset-sync";
import { normalizeAdAccountId } from "@/lib/meta";
import { extractDomain } from "@/utils/url-normalize";
import { handleApiError, jsonError } from "@/lib/api-utils";
import type { OnboardingSelection } from "@/types/meta-asset-sync";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as OnboardingSelection;
    const connectionId = body.connectionId?.trim();
    const adAccountId = body.adAccountId?.trim();

    if (!connectionId || !adAccountId) {
      return jsonError("connectionId ve adAccountId gerekli", 400);
    }

    const connection = await getMetaConnectionById(connectionId);
    if (!connection) return jsonError("Baglanti bulunamadi", 404);

    const normalizedAdAccountId = normalizeAdAccountId(adAccountId);

    if (body.businessId) {
      await updateMetaBusinessProfile(connectionId, {
        metaBusinessId: body.businessId,
      });
    }

    await addLinkedAdAccount({
      connectionId,
      adAccountId: normalizedAdAccountId,
      adAccountName: body.adAccountName ?? normalizedAdAccountId,
      select: true,
    });

    await updateSelectedAdAccount({
      connectionId,
      adAccountId: normalizedAdAccountId,
      adAccountName: body.adAccountName ?? normalizedAdAccountId,
    });

    await upsertAdAccountProfile({
      connectionId,
      adAccountId: normalizedAdAccountId,
      businessId: body.businessId,
      defaultPageId: body.pageId,
      defaultPageName: body.pageName,
      defaultInstagramId: body.instagramId,
      defaultInstagramUsername: body.instagramUsername,
      defaultPixelId: body.pixelId,
      defaultPixelName: body.pixelName,
      defaultPixelEventType: body.pixelId ? "PURCHASE" : undefined,
      defaultWebsiteUrl: body.websiteUrl,
      defaultDomain: body.websiteUrl ? extractDomain(body.websiteUrl) ?? undefined : undefined,
      pageSource: body.pageId ? "direct_user_accounts" : undefined,
      pixelSource: body.pixelId ? "direct_adspixels" : undefined,
      websiteSource: body.websiteUrl ? "manual" : undefined,
      instagramSource: body.instagramId ? "oauth_sync" : undefined,
      pageConfidence: body.pageId ? 100 : undefined,
      pixelConfidence: body.pixelId ? 100 : undefined,
      websiteConfidence: body.websiteUrl ? 100 : undefined,
      instagramConfidence: body.instagramId ? 100 : undefined,
      lastDiscoveredAt: new Date().toISOString(),
    });

    await setOnboardingCompleted(connectionId, true);
    await syncMetaConnectionAssets(connectionId);

    return NextResponse.json({ ok: true, connectionId, adAccountId: normalizedAdAccountId });
  } catch (error) {
    return handleApiError(error);
  }
}
