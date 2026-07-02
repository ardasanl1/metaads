import "server-only";

import { getMetaConnectionById } from "./db";
import { MetaApiError, metaRequest } from "./meta";
import { extractMetaErrorMessage } from "./meta-errors";
import {
  adAccountIdsMatch,
  getNumericAdAccountId,
  normalizeAdAccountId,
  type AdAccountRaw,
} from "@/utils/ad-account";
import type {
  BusinessDiscoveryError,
  BusinessDiscoveryMatch,
  BusinessDiscoveryResult,
  BusinessRelationship,
} from "@/types/meta/business-discovery";

type BusinessRow = { id: string; name: string };

type PagedResult<T> = {
  data?: T[];
  paging?: { next?: string };
};

type PermissionRow = { permission: string; status: string };

function graphBaseUrl(): string {
  const version = process.env.META_API_VERSION?.trim() || "v23.0";
  return `https://graph.facebook.com/${version}`;
}

function toDiscoveryError(
  step: string,
  error: unknown,
  businessId?: string,
): BusinessDiscoveryError {
  if (error instanceof MetaApiError) {
    return {
      step,
      businessId,
      message: error.message,
    };
  }
  const message = error instanceof Error ? error.message : "Bilinmeyen hata";
  return { step, businessId, message };
}

function toDiscoveryErrorFromResponse(
  step: string,
  data: { error?: { message?: string; type?: string; code?: number } },
  businessId?: string,
): BusinessDiscoveryError {
  return {
    step,
    businessId,
    code: data.error?.code,
    type: data.error?.type,
    message: extractMetaErrorMessage(data, "Meta API isteği başarısız"),
  };
}

async function fetchAllPaged<T>(
  initialPath: string,
  token: string,
  step: string,
  errors: BusinessDiscoveryError[],
  businessId?: string,
): Promise<T[]> {
  const baseUrl = graphBaseUrl();
  let nextPath: string | null = initialPath;
  const results: T[] = [];

  while (nextPath) {
    try {
      const url = nextPath.startsWith("http") ? nextPath : `${baseUrl}/${nextPath.replace(/^\//, "")}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as PagedResult<T> & {
        error?: { message?: string; type?: string; code?: number };
      };

      if (!response.ok || data.error) {
        errors.push(toDiscoveryErrorFromResponse(step, data, businessId));
        break;
      }

      if (data.data?.length) {
        results.push(...data.data);
      }

      if (data.paging?.next) {
        nextPath = data.paging.next.replace(`${baseUrl}/`, "");
      } else {
        nextPath = null;
      }
    } catch (error) {
      errors.push(toDiscoveryError(step, error, businessId));
      break;
    }
  }

  return results;
}

function accountMatchesTarget(account: AdAccountRaw, targetNumericId: string): boolean {
  const numericFromAccount = (account.account_id ?? getNumericAdAccountId(account.id)).trim();
  return numericFromAccount === targetNumericId || adAccountIdsMatch(account.id, targetNumericId);
}

function addMatch(
  matches: Map<string, BusinessDiscoveryMatch>,
  match: BusinessDiscoveryMatch,
): void {
  const key = `${match.businessId}:${match.relationship}`;
  if (!matches.has(key)) {
    matches.set(key, match);
  }
}

export async function discoverBusinessForAdAccount(input: {
  connectionId: string;
  adAccountId: string;
}): Promise<BusinessDiscoveryResult> {
  const errors: BusinessDiscoveryError[] = [];
  const normalizedAdAccountId = normalizeAdAccountId(input.adAccountId);
  const targetNumericId = getNumericAdAccountId(normalizedAdAccountId);

  const emptyResult = (
    partial: Partial<BusinessDiscoveryResult> = {},
  ): BusinessDiscoveryResult => ({
    success: false,
    tokenUser: { id: "", name: "" },
    permissions: { granted: [], declined: [] },
    businessesFound: 0,
    businesses: [],
    normalizedAdAccountId,
    matchedBusinesses: [],
    matches: [],
    errors,
    ...partial,
  });

  if (!normalizedAdAccountId) {
    errors.push({
      step: "normalize_ad_account",
      message: "Reklam hesabı ID geçersiz",
    });
    return emptyResult();
  }

  const connection = await getMetaConnectionById(input.connectionId);
  if (!connection) {
    errors.push({
      step: "connection",
      message: "Bağlantı bulunamadı",
    });
    return emptyResult();
  }

  const token = connection.accessToken;
  const matchMap = new Map<string, BusinessDiscoveryMatch>();

  let tokenUser = { id: "", name: "" };
  try {
    const me = await metaRequest<{ id: string; name?: string }>("me?fields=id,name", {
      token,
      connectionId: input.connectionId,
    });
    tokenUser = { id: me.id, name: me.name?.trim() || me.id };
  } catch (error) {
    errors.push(toDiscoveryError("me", error));
    return emptyResult({ tokenUser });
  }

  const granted: string[] = [];
  const declined: string[] = [];
  try {
    const permissions = await metaRequest<{ data?: PermissionRow[] }>("me/permissions", {
      token,
      connectionId: input.connectionId,
    });
    for (const row of permissions.data ?? []) {
      if (row.status === "granted") granted.push(row.permission);
      else if (row.status === "declined") declined.push(row.permission);
    }
  } catch (error) {
    errors.push(toDiscoveryError("me_permissions", error));
  }

  let businesses: BusinessRow[] = [];
  try {
    businesses = await fetchAllPaged<BusinessRow>(
      "me/businesses?fields=id,name&limit=100",
      token,
      "me_businesses",
      errors,
    );
  } catch (error) {
    errors.push(toDiscoveryError("me_businesses", error));
  }

  const businessSummaries: BusinessDiscoveryResult["businesses"] = [];

  for (const business of businesses) {
    let owned: AdAccountRaw[] = [];
    let client: AdAccountRaw[] = [];
    let matched = false;

    try {
      owned = await fetchAllPaged<AdAccountRaw>(
        `${business.id}/owned_ad_accounts?fields=id,account_id,name,account_status&limit=100`,
        token,
        "owned_ad_accounts",
        errors,
        business.id,
      );
    } catch (error) {
      errors.push(toDiscoveryError("owned_ad_accounts", error, business.id));
    }

    try {
      client = await fetchAllPaged<AdAccountRaw>(
        `${business.id}/client_ad_accounts?fields=id,account_id,name,account_status&limit=100`,
        token,
        "client_ad_accounts",
        errors,
        business.id,
      );
    } catch (error) {
      errors.push(toDiscoveryError("client_ad_accounts", error, business.id));
    }

    for (const account of owned) {
      if (accountMatchesTarget(account, targetNumericId)) {
        matched = true;
        addMatch(matchMap, {
          businessId: business.id,
          businessName: business.name,
          relationship: "owned",
        });
      }
    }

    for (const account of client) {
      if (accountMatchesTarget(account, targetNumericId)) {
        matched = true;
        addMatch(matchMap, {
          businessId: business.id,
          businessName: business.name,
          relationship: "client",
        });
      }
    }

    businessSummaries.push({
      id: business.id,
      name: business.name,
      ownedAdAccountCount: owned.length,
      clientAdAccountCount: client.length,
      matched,
    });
  }

  try {
    const account = await metaRequest<AdAccountRaw & { business?: { id?: string; name?: string } }>(
      `${normalizedAdAccountId}?fields=id,account_id,name,account_status,currency,timezone_name,business{id,name}`,
      { token, connectionId: input.connectionId },
    );
    if (account.business?.id?.trim()) {
      const businessId = account.business.id.trim();
      const businessName = account.business.name?.trim() || businessId;
      const alreadyMatched = Array.from(matchMap.values()).some((m) => m.businessId === businessId);
      if (!alreadyMatched) {
        addMatch(matchMap, {
          businessId,
          businessName,
          relationship: "ad_account_field",
        });
      }
      if (!businessSummaries.some((b) => b.id === businessId)) {
        businessSummaries.push({
          id: businessId,
          name: businessName,
          ownedAdAccountCount: 0,
          clientAdAccountCount: 0,
          matched: true,
        });
      } else {
        const summary = businessSummaries.find((b) => b.id === businessId);
        if (summary) summary.matched = true;
      }
    }
  } catch (error) {
    errors.push(toDiscoveryError("ad_account_business_field", error));
  }

  const matches = Array.from(matchMap.values());
  const matchedBusinesses = matches.map((match) => ({
    id: match.businessId,
    name: match.businessName,
    relationship: match.relationship,
  }));

  return {
    success: matches.length > 0,
    tokenUser,
    permissions: { granted, declined },
    businessesFound: businesses.length,
    businesses: businessSummaries,
    normalizedAdAccountId,
    matchedBusinesses,
    matches,
    errors,
  };
}

export function pickPreferredBusinessMatch(
  matches: BusinessDiscoveryMatch[],
): BusinessDiscoveryMatch | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const priority: BusinessRelationship[] = ["owned", "client", "ad_account_field"];
  for (const relationship of priority) {
    const found = matches.find((match) => match.relationship === relationship);
    if (found) return found;
  }
  return matches[0];
}
