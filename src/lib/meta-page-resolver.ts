import "server-only";

import { ensureMetaBusinessId } from "@/lib/meta";
import { graphBaseUrl, metaRequest } from "@/lib/meta";
import {
  getTokenCapabilityDiagnostics,
  requireMetaConnectionContext,
  type TokenCapabilityDiagnostics,
} from "@/lib/meta-connection-context";
import { normalizeAdAccountId } from "@/utils/ad-account";
import type { MetaPageOption } from "@/types/meta-assets";

const PAGE_AD_TASKS = new Set(["ADVERTISE", "MANAGE"]);
const PAGE_FETCH_LIMIT = 500;

export type PageResolverDiagnostic = {
  tokenType?: string;
  userAccountsRequestSucceeded: boolean;
  userAccountsCount: number;
  userAccountsError?: string;
  businessOwnedRequestSucceeded?: boolean;
  businessOwnedCount?: number;
  businessOwnedError?: string;
  businessClientRequestSucceeded?: boolean;
  businessClientCount?: number;
  businessClientError?: string;
  adAccountPromoteRequestSucceeded?: boolean;
  adAccountPromoteCount?: number;
  availableForAdsCount: number;
  missingPermissions: string[];
  reason?: string;
};

export type PageResolverResult = {
  success: boolean;
  pages: MetaPageOption[];
  diagnostic: PageResolverDiagnostic;
  tokenDiagnostics: TokenCapabilityDiagnostics;
};

type RawMeAccountPage = {
  id: string;
  name?: string;
  tasks?: string[];
  instagram_business_account?: { id?: string };
  picture?: { data?: { url?: string } };
};

type PagedResult<T> = { data?: T[]; paging?: { next?: string } };

async function fetchPagedWithToken<T>(
  initialPath: string,
  token: string,
  connectionId: string,
  max = PAGE_FETCH_LIMIT,
): Promise<{ items: T[]; error?: string }> {
  const baseUrl = graphBaseUrl();
  let nextPath: string | null = initialPath;
  const results: T[] = [];

  while (nextPath && results.length < max) {
    try {
      const response: PagedResult<T> = await metaRequest<PagedResult<T>>(nextPath, {
        token,
        connectionId,
      });
      if (response.data) results.push(...response.data);
      if (response.paging?.next && results.length < max) {
        nextPath = response.paging.next.replace(`${baseUrl}/`, "");
      } else {
        nextPath = null;
      }
    } catch (error) {
      return {
        items: results,
        error: error instanceof Error ? error.message : "Sayfalama isteği başarısız",
      };
    }
  }

  return { items: results.slice(0, max) };
}

function pageIsAvailableForAds(tasks?: string[]): boolean {
  if (!tasks || tasks.length === 0) return true;
  return tasks.some((task) => PAGE_AD_TASKS.has(task));
}

function mapMePage(page: RawMeAccountPage, source: MetaPageOption["source"]): MetaPageOption {
  const tasks = page.tasks ?? [];
  return {
    id: page.id,
    name: page.name?.trim() || page.id,
    pictureUrl: page.picture?.data?.url,
    tasks,
    instagramBusinessAccountId: page.instagram_business_account?.id,
    source,
    available: pageIsAvailableForAds(tasks),
  };
}

function mergePage(existing: MetaPageOption | undefined, incoming: MetaPageOption): MetaPageOption {
  if (!existing) return incoming;
  const tasks = [...new Set([...(existing.tasks ?? []), ...(incoming.tasks ?? [])])];
  return {
    ...existing,
    name: existing.name === existing.id && incoming.name !== incoming.id ? incoming.name : existing.name,
    pictureUrl: existing.pictureUrl ?? incoming.pictureUrl,
    tasks,
    instagramBusinessAccountId:
      existing.instagramBusinessAccountId ?? incoming.instagramBusinessAccountId,
    available: existing.available || incoming.available,
  };
}

function buildEmptyPagesReason(input: {
  diagnostic: PageResolverDiagnostic;
  tokenDiagnostics: TokenCapabilityDiagnostics;
  businessId?: string;
}): string {
  const { diagnostic, tokenDiagnostics } = input;
  if (!tokenDiagnostics.grantedPermissions.includes("pages_show_list")) {
    return "pages_show_list izni eksik";
  }
  if (diagnostic.userAccountsError?.includes("pages_read_engagement")) {
    return "pages_read_engagement izni eksik";
  }
  if (!input.businessId && tokenDiagnostics.tokenType === "system_user") {
    return "System User token için businessId gerekli";
  }
  if (diagnostic.userAccountsError && !diagnostic.userAccountsRequestSucceeded) {
    return `User accounts isteği başarısız: ${diagnostic.userAccountsError}`;
  }
  if (diagnostic.availableForAdsCount === 0 && diagnostic.userAccountsCount > 0) {
    return "Page bulundu ancak reklam görevi (ADVERTISE/MANAGE) yok";
  }
  if (
    diagnostic.userAccountsCount === 0 &&
    (diagnostic.businessOwnedCount ?? 0) === 0 &&
    (diagnostic.adAccountPromoteCount ?? 0) === 0
  ) {
    return "Token sahibine atanmış kullanılabilir Page bulunamadı";
  }
  return "Facebook Page bulunamadı";
}

export async function resolveFacebookPages(input: {
  connectionId: string;
  businessId?: string;
  adAccountId?: string;
}): Promise<PageResolverResult> {
  const ctx = await requireMetaConnectionContext(input);
  const tokenDiagnostics = await getTokenCapabilityDiagnostics(ctx);

  const businessId =
    input.businessId?.trim() ||
    ctx.metaBusinessId ||
    (await ensureMetaBusinessId(ctx.connectionId, input.adAccountId)) ||
    undefined;

  const diagnostic: PageResolverDiagnostic = {
    tokenType: tokenDiagnostics.tokenType,
    userAccountsRequestSucceeded: false,
    userAccountsCount: 0,
    availableForAdsCount: 0,
    missingPermissions: tokenDiagnostics.missingPermissions,
  };

  const byId = new Map<string, MetaPageOption>();
  const meFields = "id,name,tasks,instagram_business_account{id},picture{url}";

  const userAccounts = await fetchPagedWithToken<RawMeAccountPage>(
    `me/accounts?fields=${meFields}&limit=100`,
    ctx.accessToken,
    ctx.connectionId,
  );

  if (userAccounts.error) {
    diagnostic.userAccountsError = userAccounts.error;
  } else {
    diagnostic.userAccountsRequestSucceeded = true;
  }

  for (const page of userAccounts.items) {
    if (!page?.id) continue;
    const mapped = mapMePage(page, "user_accounts");
    byId.set(page.id, mergePage(byId.get(page.id), mapped));
  }
  diagnostic.userAccountsCount = userAccounts.items.length;

  const useBusinessFallback =
    userAccounts.items.length === 0 ||
    tokenDiagnostics.tokenType === "system_user" ||
    Boolean(userAccounts.error);

  if (useBusinessFallback && businessId) {
    const owned = await fetchPagedWithToken<RawMeAccountPage>(
      `${businessId}/owned_pages?fields=${meFields}&limit=100`,
      ctx.accessToken,
      ctx.connectionId,
    );
    if (owned.error) {
      diagnostic.businessOwnedError = owned.error;
      diagnostic.businessOwnedRequestSucceeded = false;
    } else {
      diagnostic.businessOwnedRequestSucceeded = true;
      diagnostic.businessOwnedCount = owned.items.length;
      for (const page of owned.items) {
        if (!page?.id) continue;
        byId.set(page.id, mergePage(byId.get(page.id), mapMePage(page, "business_owned")));
      }
    }

    const client = await fetchPagedWithToken<RawMeAccountPage>(
      `${businessId}/client_pages?fields=${meFields}&limit=100`,
      ctx.accessToken,
      ctx.connectionId,
    );
    if (client.error) {
      diagnostic.businessClientError = client.error;
      diagnostic.businessClientRequestSucceeded = false;
    } else {
      diagnostic.businessClientRequestSucceeded = true;
      diagnostic.businessClientCount = client.items.length;
      for (const page of client.items) {
        if (!page?.id) continue;
        byId.set(page.id, mergePage(byId.get(page.id), mapMePage(page, "business_client")));
      }
    }
  } else if (useBusinessFallback && !businessId) {
    diagnostic.reason = "Business ID eksik; System User Page keşfi yapılamadı";
  }

  const accountPath = input.adAccountId ? normalizeAdAccountId(input.adAccountId) : "";
  if (accountPath) {
    const promoted = await fetchPagedWithToken<RawMeAccountPage>(
      `${accountPath}/promote_pages?fields=${meFields}&limit=100`,
      ctx.accessToken,
      ctx.connectionId,
    );
    if (promoted.error) {
      diagnostic.adAccountPromoteRequestSucceeded = false;
    } else {
      diagnostic.adAccountPromoteRequestSucceeded = true;
      diagnostic.adAccountPromoteCount = promoted.items.length;
      for (const page of promoted.items) {
        if (!page?.id) continue;
        byId.set(page.id, mergePage(byId.get(page.id), mapMePage(page, "ad_account")));
      }
    }
  }

  const availablePages = Array.from(byId.values()).filter((p) => p.available !== false);
  diagnostic.availableForAdsCount = availablePages.length;

  if (availablePages.length === 0 && !diagnostic.reason) {
    diagnostic.reason = buildEmptyPagesReason({ diagnostic, tokenDiagnostics, businessId });
  }

  const success =
    diagnostic.userAccountsRequestSucceeded ||
    diagnostic.businessOwnedRequestSucceeded === true ||
    diagnostic.businessClientRequestSucceeded === true ||
    diagnostic.adAccountPromoteRequestSucceeded === true;

  return {
    success,
    pages: availablePages.sort((a, b) => a.name.localeCompare(b.name, "tr")),
    diagnostic,
    tokenDiagnostics,
  };
}
