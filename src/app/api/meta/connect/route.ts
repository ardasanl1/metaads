import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { saveMetaConnection, setActiveConnection } from "@/lib/db";
import { MetaApiError, normalizeAdAccountId, resolveTokenIdentity, verifyMetaConnection } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { discoverAdAccountProfile } from "@/lib/ad-account-profile-resolver";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as {
      accessToken?: string;
      adAccountId?: string;
      adAccountName?: string;
      metaBusinessId?: string;
    };

    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
    const adAccountId = typeof body.adAccountId === "string" ? body.adAccountId.trim() : "";
    const adAccountName = typeof body.adAccountName === "string" ? body.adAccountName.trim() : "";
    const manualBusinessId =
      typeof body.metaBusinessId === "string" ? body.metaBusinessId.trim() : "";

    if (!accessToken) {
      return jsonError("Meta Access Token gerekli", 400);
    }

    const verified = await resolveTokenIdentity(accessToken);
    if (!verified.metaUserId) {
      return jsonError("Access Token gecersiz. Token ve izinleri kontrol edin.", 400);
    }

    let normalizedAccountId = adAccountId ? normalizeAdAccountId(adAccountId) : "";
    let accountName = adAccountName;

    if (normalizedAccountId) {
      const accountVerified = await verifyMetaConnection(accessToken, normalizedAccountId);
      normalizedAccountId = accountVerified.adAccountId;
      accountName = accountName || accountVerified.accountName;
    }

    const saved = await saveMetaConnection({
      accessToken,
      metaUserId: verified.metaUserId,
      metaUserName: verified.metaUserName,
      metaBusinessId: manualBusinessId || verified.metaBusinessId,
      adAccountId: normalizedAccountId,
      adAccountName: accountName,
      authMethod: "manual",
    });

    await setActiveConnection(saved.id);

    if (normalizedAccountId) {
      try {
        await discoverAdAccountProfile({
          connectionId: saved.id,
          adAccountId: normalizedAccountId,
          businessId: manualBusinessId || verified.metaBusinessId || undefined,
          forceRefresh: true,
        });
      } catch {
        // profil kesfi basarisiz olsa da baglanti kaydi tamamlanir
      }
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      connectionId: saved.id,
      metaUserId: saved.metaUserId,
      metaUserName: saved.metaUserName,
      metaBusinessId: saved.metaBusinessId,
      selectedAdAccountId: saved.selectedAdAccountId || null,
      selectedAdAccountName: saved.selectedAdAccountName || null,
    });
  } catch (error) {
    if (error instanceof MetaApiError) {
      return jsonError("Token gecersiz. Bilgileri kontrol edin.", error.status);
    }
    return handleApiError(error);
  }
}
