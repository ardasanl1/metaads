import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { resolveFacebookPages } from "@/lib/meta-page-resolver";
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
    const forceRefresh = request.nextUrl.searchParams.get("forceRefresh") === "1";

    if (!connectionId) return jsonError("connectionId gerekli", 400);
    if (!adAccountId) return jsonError("adAccountId gerekli", 400);

    const ctx = await requireMetaConnectionContext({ connectionId, adAccountId, businessId });
    const tokenDiagnostics = await getTokenCapabilityDiagnostics(ctx);
    const pages = await resolveFacebookPages({
      connectionId,
      businessId,
      adAccountId,
      forceRefresh,
    });
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
      tokenSubject: {
        id: pages.diagnostic.tokenSubject?.id ?? tokenDiagnostics.tokenSubjectId ?? "",
        name: pages.diagnostic.tokenSubject?.name ?? tokenDiagnostics.tokenSubjectName ?? "",
      },
      grantedPermissions: tokenDiagnostics.grantedPermissions,
      pagesRequest: pages.diagnostic.pagesRequest,
      pages: pages.diagnostic.pages,
      instagram: {
        instagramBasicGranted: instagram.diagnostic.instagramBasicGranted,
        resultCount: instagram.diagnostic.resultCount,
        reason: instagram.diagnostic.reason,
      },
      instagramAccounts: instagram.accounts.map((ig) => ({
        id: ig.id,
        username: ig.username,
        pageId: ig.pageId,
        pageName: ig.pageName,
      })),
      reason: pages.diagnostic.reason,
      errors: [...pages.diagnostic.errors, ...instagram.diagnostic.errors],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
