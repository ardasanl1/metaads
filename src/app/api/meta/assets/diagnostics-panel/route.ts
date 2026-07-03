import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { resolveFacebookPages } from "@/lib/meta-page-resolver";
import { resolveAdAccountPixels } from "@/lib/meta-pixel-resolver";
import { resolveInstagramAccounts } from "@/lib/meta-instagram-resolver";
import { getTokenCapabilityDiagnostics, requireMetaConnectionContext } from "@/lib/meta-connection-context";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Yalnızca development ortamında kullanılabilir" }, { status: 404 });
  }

  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim();
    const businessId = request.nextUrl.searchParams.get("businessId")?.trim() || undefined;
    const adAccountId = request.nextUrl.searchParams.get("adAccountId")?.trim();

    if (!connectionId) return jsonError("connectionId gerekli", 400);
    if (!adAccountId) return jsonError("adAccountId gerekli", 400);

    const ctx = await requireMetaConnectionContext({ connectionId, adAccountId, businessId });
    const tokenDiagnostics = await getTokenCapabilityDiagnostics(ctx);
    const pages = await resolveFacebookPages({ connectionId, businessId, adAccountId });
    const pixels = await resolveAdAccountPixels({ connectionId, adAccountId });
    const instagram = await resolveInstagramAccounts({
      connectionId,
      adAccountId,
      pages: pages.pages.map((p) => ({
        id: p.id,
        name: p.name,
        instagramBusinessAccountId: p.instagramBusinessAccountId,
      })),
    });

    return NextResponse.json({
      connectionId,
      token: {
        subjectName: tokenDiagnostics.tokenSubjectName,
        subjectId: tokenDiagnostics.tokenSubjectId,
        tokenType: tokenDiagnostics.tokenType,
        grantedPermissions: tokenDiagnostics.grantedPermissions,
        missingPermissions: tokenDiagnostics.missingPermissions,
        requestErrors: tokenDiagnostics.requestErrors,
      },
      adAccount: pages.diagnostic.adAccount,
      meAccounts: pages.diagnostic.meAccounts,
      promotePages: pages.diagnostic.promotePages,
      profilePage: pages.diagnostic.profilePage,
      pageDiscovery: pages.diagnostic.pageDiscovery,
      pages: pages.diagnostic.pages,
      errors: [...pages.diagnostic.errors, ...pixels.diagnostic.errors, ...instagram.diagnostic.errors],
      status: pages.diagnostic.status,
      reason: pages.diagnostic.reason,
      tokenSubject: pages.diagnostic.tokenSubject,
      usablePages: pages.pages.map((p) => ({
        id: p.id,
        name: p.name,
        sources: p.sources,
        tasks: p.tasks,
        usableForAds: p.usableForAds,
      })),
      pixels: {
        normalizedAdAccountId: pixels.diagnostic.normalizedAdAccountId,
        adAccountAccessible: pixels.diagnostic.adAccountAccessible,
        adspixels: pixels.diagnostic.adspixels,
        customConversions: pixels.diagnostic.customConversions,
        historicalAdSets: pixels.diagnostic.historicalAdSets,
        pixelRequestSucceeded: pixels.diagnostic.pixelRequestSucceeded,
        resultCount: pixels.diagnostic.resultCount,
        directlyVerifiedCount: pixels.diagnostic.directlyVerifiedCount,
        status: pixels.diagnostic.status,
        reason: pixels.diagnostic.reason,
        metaErrorCode: pixels.diagnostic.metaErrorCode,
      },
      instagram: instagram.diagnostic,
      instagramAccounts: instagram.accounts.map((ig) => ({
        id: ig.id,
        username: ig.username,
        pageId: ig.pageId,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
