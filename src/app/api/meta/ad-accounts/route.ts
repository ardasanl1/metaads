import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import {
  addLinkedAdAccount,
  getMetaConnectionById,
  updateMetaBusinessProfile,
} from "@/lib/db";
import { MetaApiError, verifyMetaConnection } from "@/lib/meta";
import {
  discoverBusinessForAdAccount,
  pickPreferredBusinessMatch,
} from "@/lib/meta-business-discovery";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { discoverAdAccountProfile } from "@/lib/ad-account-profile-resolver";
import { normalizeAdAccountId } from "@/utils/ad-account";
import type { BusinessDiscoveryMatch } from "@/types/meta/business-discovery";

function pickMatch(
  matches: BusinessDiscoveryMatch[],
  businessId?: string,
): BusinessDiscoveryMatch | null {
  if (businessId?.trim()) {
    return matches.find((match) => match.businessId === businessId.trim()) ?? null;
  }
  return pickPreferredBusinessMatch(matches);
}

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim();
    if (!connectionId) return jsonError("connectionId gerekli", 400);

    const connection = await getMetaConnectionById(connectionId);
    if (!connection) return jsonError("Meta hesabı bağlı değil", 400);

    const linked = connection.linkedAdAccounts;

    return NextResponse.json({
      adAccounts: linked.map((account) => ({
        id: account.id,
        accountId: account.accountId,
        name: account.name,
        connectionId: connection.id,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as {
      adAccountId?: string;
      connectionId?: string;
      businessId?: string;
    };

    const adAccountId =
      typeof body.adAccountId === "string" ? normalizeAdAccountId(body.adAccountId.trim()) : "";
    const connectionId =
      typeof body.connectionId === "string" ? body.connectionId.trim() : "";
    const requestedBusinessId =
      typeof body.businessId === "string" ? body.businessId.trim() : "";

    if (!adAccountId) {
      return jsonError("Reklam hesabı ID gerekli (ör. act_123456789)", 400);
    }
    if (!connectionId) {
      return jsonError("connectionId gerekli", 400);
    }

    const connection = await getMetaConnectionById(connectionId);
    if (!connection) {
      return jsonError("Seçili bağlantı bulunamadı", 404);
    }

    const verified = await verifyMetaConnection(connection.accessToken, adAccountId);

    const discovery = await discoverBusinessForAdAccount({
      connectionId: connection.id,
      adAccountId: verified.adAccountId,
    });

    if (discovery.matches.length > 1 && !requestedBusinessId) {
      return NextResponse.json({
        ok: true,
        needsBusinessSelection: true,
        normalizedAdAccountId: discovery.normalizedAdAccountId,
        matches: discovery.matches,
        tokenUser: discovery.tokenUser,
        permissions: discovery.permissions,
        businessesFound: discovery.businessesFound,
        errors: discovery.errors,
      });
    }

    const selectedMatch = pickMatch(discovery.matches, requestedBusinessId);

    if (!selectedMatch) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reklam hesabı için Business eşleşmesi bulunamadı",
          normalizedAdAccountId: discovery.normalizedAdAccountId,
          tokenUser: discovery.tokenUser,
          permissions: discovery.permissions,
          businessesFound: discovery.businessesFound,
          businesses: discovery.businesses,
          matchedBusinesses: discovery.matchedBusinesses,
          errors: discovery.errors,
        },
        { status: 404 },
      );
    }

    await updateMetaBusinessProfile(connection.id, {
      metaBusinessId: selectedMatch.businessId,
      metaBusinessName: selectedMatch.businessName,
    });

    const result = await addLinkedAdAccount({
      connectionId: connection.id,
      adAccountId: verified.adAccountId,
      adAccountName: verified.accountName,
      select: true,
    });

    try {
      await discoverAdAccountProfile({
        connectionId: connection.id,
        adAccountId: verified.adAccountId,
        businessId: selectedMatch.businessId,
        forceRefresh: true,
      });
    } catch {
      // hesap eklendi; profil kesfi sonra tekrar denenebilir
    }

    return NextResponse.json({
      ok: true,
      needsBusinessSelection: false,
      connectionId: connection.id,
      business: {
        businessId: selectedMatch.businessId,
        businessName: selectedMatch.businessName,
        relationship: selectedMatch.relationship,
      },
      adAccounts: result.linkedAdAccounts.map((account) => ({
        id: account.id,
        accountId: account.accountId,
        name: account.name,
        connectionId: connection.id,
      })),
      selectedAdAccountId: result.selectedAdAccountId,
      selectedAdAccountName: result.selectedAdAccountName,
      discovery: {
        tokenUser: discovery.tokenUser,
        permissions: discovery.permissions,
        businessesFound: discovery.businessesFound,
        errors: discovery.errors,
      },
    });
  } catch (error) {
    if (error instanceof MetaApiError) {
      return jsonError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
