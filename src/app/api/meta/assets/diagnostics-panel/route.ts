import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { resolveFacebookPages } from "@/lib/meta-page-resolver";
import { resolveAdAccountPixels } from "@/lib/meta-pixel-resolver";
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

    return NextResponse.json({
      token: {
        subjectName: tokenDiagnostics.tokenSubjectName,
        subjectId: tokenDiagnostics.tokenSubjectId,
        tokenType: tokenDiagnostics.tokenType,
        grantedPermissions: tokenDiagnostics.grantedPermissions,
        missingPermissions: tokenDiagnostics.missingPermissions,
        requestErrors: tokenDiagnostics.requestErrors,
      },
      pages: {
        userAccountsSucceeded: pages.diagnostic.userAccountsRequestSucceeded,
        userAccountsCount: pages.diagnostic.userAccountsCount,
        businessFallbackRan:
          pages.diagnostic.businessOwnedRequestSucceeded !== undefined ||
          pages.diagnostic.businessClientRequestSucceeded !== undefined,
        availableForAdsCount: pages.diagnostic.availableForAdsCount,
        reason: pages.diagnostic.reason,
        pages: pages.pages.map((p) => ({
          id: p.id,
          name: p.name,
          tasks: p.tasks ?? [],
          source: p.source,
          available: p.available,
        })),
      },
      pixels: {
        normalizedAdAccountId: pixels.diagnostic.normalizedAdAccountId,
        adAccountAccessible: pixels.diagnostic.adAccountAccessible,
        pixelRequestSucceeded: pixels.diagnostic.pixelRequestSucceeded,
        resultCount: pixels.diagnostic.resultCount,
        reason: pixels.diagnostic.reason,
        metaErrorCode: pixels.diagnostic.metaErrorCode,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
