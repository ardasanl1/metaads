import "server-only";

import { ensureMetaBusinessId } from "@/lib/meta";
import { graphBaseUrl, metaRequest } from "@/lib/meta";
import {
  classifyMetaError,
  getTokenCapabilityDiagnostics,
  requireMetaConnectionContext,
  type TokenCapabilityDiagnostics,
} from "@/lib/meta-connection-context";
import { normalizeAdAccountId } from "@/utils/ad-account";
import type { MetaPageOption, MetaPageSource } from "@/types/meta-assets";

const PAGE_FETCH_LIMIT = 500;
const USER_ACCOUNT_AD_TASKS = new Set(["ADVERTISE", "MANAGE", "CREATE_CONTENT"]);

export type PageDiscoveryError = {
  source: string;
  code?: number;
  type?: string;
  message: string;
};

export type PageDiscoveryStats = {
  promotePagesRequestSucceeded: boolean;
  promotePagesCount: number;
  userAccountsRequestSucceeded: boolean;
  userAccountsCount: number;
  businessOwnedRequestSucceeded: boolean;
  businessOwnedCount: number;
  businessClientRequestSucceeded: boolean;
  businessClientCount: number;
  mergedPageCount: number;
};

export type PageResolverDiagnostic = {
  adAccount: {
    normalizedId: string;
    accessible: boolean;
  };
  pageDiscovery: PageDiscoveryStats;
  pages: Array<{
    id: string;
    name: string;
    sources: MetaPageSource[];
    tasks?: string[];
    usableForAds: boolean;
    excludeReason?: string;
  }>;
  errors: PageDiscoveryError[];
  tokenType?: string;
  missingPermissions: string[];
  reason?: string;
};

export type PageResolverResult = {
  success: boolean;
  pages: MetaPageOption[];
  diagnostic: PageResolverDiagnostic;
  tokenDiagnostics: TokenCapabilityDiagnostics;
};

type RawPage = {
  id: string;
  name?: string;
  tasks?: string[];
  instagram_business_account?: { id?: string };
  picture?: { data?: { url?: string }; url?: string };
};

type PagedResult<T> = { data?: T[]; paging?: { next?: string } };

type PageCandidate = {
  id: string;
  name: string;
  pictureUrl?: string;
  instagramBusinessAccountId?: string;
  sources: MetaPageSource[];
  tasks?: string[];
};

async function fetchPagedWithToken<T>(
  initialPath: string,
  token: string,
  connectionId: string,
  max = PAGE_FETCH_LIMIT,
): Promise<{ items: T[]; error?: PageDiscoveryError }> {
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
      const classified = classifyMetaError(error);
      return {
        items: results,
        error: {
          source: initialPath.split("?")[0],
          code: classified.code,
          type: classified.type,
          message: classified.message,
        },
      };
    }
  }

  return { items: results.slice(0, max) };
}

function pictureUrlFromRaw(page: RawPage): string | undefined {
  return page.picture?.data?.url ?? page.picture?.url;
}

function mapRawPage(page: RawPage, source: MetaPageSource): PageCandidate | null {
  if (!page?.id) return null;
  return {
    id: page.id,
    name: page.name?.trim() || page.id,
    pictureUrl: pictureUrlFromRaw(page),
    instagramBusinessAccountId: page.instagram_business_account?.id,
    sources: [source],
    tasks: page.tasks,
  };
}

function mergeCandidate(existing: PageCandidate | undefined, incoming: PageCandidate): PageCandidate {
  if (!existing) return incoming;
  const sources = [...new Set([...existing.sources, ...incoming.sources])];
  const tasks = [...new Set([...(existing.tasks ?? []), ...(incoming.tasks ?? [])])];
  return {
    id: existing.id,
    name: existing.name === existing.id && incoming.name !== incoming.id ? incoming.name : existing.name,
    pictureUrl: existing.pictureUrl ?? incoming.pictureUrl,
    instagramBusinessAccountId: existing.instagramBusinessAccountId ?? incoming.instagramBusinessAccountId,
    sources,
    tasks: tasks.length > 0 ? tasks : undefined,
  };
}

function computeUsableForAds(candidate: Pick<PageCandidate, "sources" | "tasks">): boolean {
  if (candidate.sources.includes("ad_account_promote_pages")) return true;
  if (candidate.sources.includes("business_owned") || candidate.sources.includes("business_client")) {
    return true;
  }
  if (candidate.sources.includes("user_accounts")) {
    const tasks = candidate.tasks;
    if (!tasks || tasks.length === 0) return true;
    return tasks.some((task) => USER_ACCOUNT_AD_TASKS.has(task));
  }
  return true;
}

function toMetaPageOption(candidate: PageCandidate): MetaPageOption {
  const usableForAds = computeUsableForAds(candidate);
  const primarySource = candidate.sources[0];
  return {
    id: candidate.id,
    name: candidate.name,
    pictureUrl: candidate.pictureUrl,
    instagramBusinessAccountId: candidate.instagramBusinessAccountId,
    sources: candidate.sources,
    tasks: candidate.tasks,
    usableForAds,
    available: usableForAds,
    source: primarySource === "ad_account_promote_pages" ? "ad_account" : primarySource,
  };
}

async function fetchPromotePagesFromAdAccount(
  accountPath: string,
  token: string,
  connectionId: string,
): Promise<{ pages: RawPage[]; error?: PageDiscoveryError }> {
  const nestedFields = "id,account_id,name,promote_pages{id,name,picture,instagram_business_account{id}}";
  try {
    const account = await metaRequest<{
      id?: string;
      promote_pages?: { data?: RawPage[] };
    }>(`${accountPath}?fields=${nestedFields}`, { token, connectionId });

    if (account.promote_pages?.data?.length) {
      return { pages: account.promote_pages.data };
    }
    if (account.promote_pages?.data) {
      return { pages: [] };
    }
  } catch (error) {
    const nestedError = classifyMetaError(error);
    const fallback = await fetchPagedWithToken<RawPage>(
      `${accountPath}/promote_pages?fields=id,name,picture,instagram_business_account{id}&limit=100`,
      token,
      connectionId,
    );
    if (!fallback.error) {
      return { pages: fallback.items };
    }
    try {
      const promoteOnly = await metaRequest<{ promote_pages?: { data?: Array<{ id: string }> } }>(
        `${accountPath}?fields=promote_pages`,
        { token, connectionId },
      );
      const ids = promoteOnly.promote_pages?.data ?? [];
      if (ids.length === 0) {
        return { pages: [] };
      }
      const enriched: RawPage[] = [];
      for (const row of ids) {
        if (!row.id) continue;
        try {
          const page = await metaRequest<RawPage>(
            `${row.id}?fields=id,name,picture,instagram_business_account{id}`,
            { token, connectionId },
          );
          enriched.push(page);
        } catch {
          enriched.push({ id: row.id, name: row.id });
        }
      }
      return { pages: enriched };
    } catch {
      return {
        pages: [],
        error: {
          source: "ad_account_promote_pages",
          code: nestedError.code,
          type: nestedError.type,
          message: nestedError.message,
        },
      };
    }
  }

  const edge = await fetchPagedWithToken<RawPage>(
    `${accountPath}/promote_pages?fields=id,name,picture,instagram_business_account{id}&limit=100`,
    token,
    connectionId,
  );
  if (edge.error) {
    return { pages: edge.items, error: edge.error };
  }
  return { pages: edge.items };
}

async function validatePageAccess(
  pageId: string,
  token: string,
  connectionId: string,
): Promise<{ valid: boolean; page?: RawPage; error?: PageDiscoveryError }> {
  try {
    const page = await metaRequest<RawPage>(`${pageId}?fields=id,name,picture`, {
      token,
      connectionId,
    });
    return { valid: true, page };
  } catch (error) {
    const classified = classifyMetaError(error);
    return {
      valid: false,
      error: {
        source: `page_validation:${pageId}`,
        code: classified.code,
        type: classified.type,
        message: classified.message,
      },
    };
  }
}

function buildEmptyPagesReason(input: {
  stats: PageDiscoveryStats;
  errors: PageDiscoveryError[];
  validatedCount: number;
  businessId?: string;
}): string {
  const { stats, errors, validatedCount } = input;

  const permissionError = errors.find(
    (e) =>
      e.message.toLowerCase().includes("permission") ||
      e.code === 10 ||
      e.code === 200,
  );
  if (permissionError) {
    return `Meta isteği permission hatası verdi: ${permissionError.message}`;
  }

  if (stats.mergedPageCount > 0 && validatedCount === 0) {
    return "Page bulundu ancak temel Page sorgusu başarısız oldu";
  }

  if (stats.promotePagesRequestSucceeded && stats.promotePagesCount === 0) {
    if (stats.userAccountsCount === 0 && stats.businessOwnedCount === 0 && stats.businessClientCount === 0) {
      return "Reklam hesabının promote_pages alanı boş döndü; diğer kaynaklarda da Page yok";
    }
    return "Reklam hesabının promote_pages alanı boş döndü";
  }

  if (stats.userAccountsRequestSucceeded && stats.userAccountsCount === 0) {
    if (stats.businessOwnedCount > 0 || stats.businessClientCount > 0) {
      return "Business altında Page bulundu ancak birleştirme sonrası kullanılabilir Page kalmadı";
    }
    if (stats.promotePagesCount === 0) {
      return "/me/accounts Page döndürmedi";
    }
  }

  if (
    stats.promotePagesCount === 0 &&
    stats.userAccountsCount === 0 &&
    stats.businessOwnedCount === 0 &&
    stats.businessClientCount === 0
  ) {
    return "Tüm kaynaklar kontrol edildi; kullanılabilir Page bulunamadı";
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

  const accountPath = input.adAccountId ? normalizeAdAccountId(input.adAccountId) : "";
  const errors: PageDiscoveryError[] = [];
  const byId = new Map<string, PageCandidate>();

  const stats: PageDiscoveryStats = {
    promotePagesRequestSucceeded: false,
    promotePagesCount: 0,
    userAccountsRequestSucceeded: false,
    userAccountsCount: 0,
    businessOwnedRequestSucceeded: false,
    businessOwnedCount: 0,
    businessClientRequestSucceeded: false,
    businessClientCount: 0,
    mergedPageCount: 0,
  };

  let adAccountAccessible = false;
  if (accountPath) {
    try {
      await metaRequest<{ id: string }>(`${accountPath}?fields=id,account_id,name`, {
        token: ctx.accessToken,
        connectionId: ctx.connectionId,
      });
      adAccountAccessible = true;
    } catch (error) {
      const classified = classifyMetaError(error);
      errors.push({
        source: "ad_account",
        code: classified.code,
        type: classified.type,
        message: classified.message,
      });
    }

    if (adAccountAccessible) {
      const promote = await fetchPromotePagesFromAdAccount(
        accountPath,
        ctx.accessToken,
        ctx.connectionId,
      );
      if (promote.error) {
        errors.push(promote.error);
        stats.promotePagesRequestSucceeded = false;
      } else {
        stats.promotePagesRequestSucceeded = true;
      }
      stats.promotePagesCount = promote.pages.length;
      for (const page of promote.pages) {
        const mapped = mapRawPage(page, "ad_account_promote_pages");
        if (!mapped) continue;
        byId.set(mapped.id, mergeCandidate(byId.get(mapped.id), mapped));
      }
    }
  }

  const pageFields = "id,name,tasks,picture,instagram_business_account{id}";
  const businessPageFields = "id,name,picture,instagram_business_account{id}";

  const isUserToken =
    tokenDiagnostics.tokenType === "user" ||
    tokenDiagnostics.grantedPermissions.includes("pages_show_list");

  if (isUserToken) {
    const userAccounts = await fetchPagedWithToken<RawPage>(
      `me/accounts?fields=${pageFields}&limit=100`,
      ctx.accessToken,
      ctx.connectionId,
    );
    if (userAccounts.error) {
      errors.push({ ...userAccounts.error, source: "user_accounts" });
      stats.userAccountsRequestSucceeded = false;
    } else {
      stats.userAccountsRequestSucceeded = true;
    }
    stats.userAccountsCount = userAccounts.items.length;
    for (const page of userAccounts.items) {
      const mapped = mapRawPage(page, "user_accounts");
      if (!mapped) continue;
      byId.set(mapped.id, mergeCandidate(byId.get(mapped.id), mapped));
    }
  }

  if (businessId) {
    const owned = await fetchPagedWithToken<RawPage>(
      `${businessId}/owned_pages?fields=${businessPageFields}&limit=100`,
      ctx.accessToken,
      ctx.connectionId,
    );
    if (owned.error) {
      errors.push({ ...owned.error, source: "business_owned" });
      stats.businessOwnedRequestSucceeded = false;
    } else {
      stats.businessOwnedRequestSucceeded = true;
    }
    stats.businessOwnedCount = owned.items.length;
    for (const page of owned.items) {
      const mapped = mapRawPage(page, "business_owned");
      if (!mapped) continue;
      byId.set(mapped.id, mergeCandidate(byId.get(mapped.id), mapped));
    }

    const client = await fetchPagedWithToken<RawPage>(
      `${businessId}/client_pages?fields=${businessPageFields}&limit=100`,
      ctx.accessToken,
      ctx.connectionId,
    );
    if (client.error) {
      errors.push({ ...client.error, source: "business_client" });
      stats.businessClientRequestSucceeded = false;
    } else {
      stats.businessClientRequestSucceeded = true;
    }
    stats.businessClientCount = client.items.length;
    for (const page of client.items) {
      const mapped = mapRawPage(page, "business_client");
      if (!mapped) continue;
      byId.set(mapped.id, mergeCandidate(byId.get(mapped.id), mapped));
    }
  }

  stats.mergedPageCount = byId.size;

  const diagnosticPages: PageResolverDiagnostic["pages"] = [];
  const validatedPages: MetaPageOption[] = [];

  for (const candidate of byId.values()) {
    const usableForAds = computeUsableForAds(candidate);
    const validation = await validatePageAccess(candidate.id, ctx.accessToken, ctx.connectionId);

    if (!validation.valid) {
      if (validation.error) errors.push(validation.error);
      diagnosticPages.push({
        id: candidate.id,
        name: candidate.name,
        sources: candidate.sources,
        tasks: candidate.tasks,
        usableForAds,
        excludeReason: validation.error?.message ?? "Page doğrulama başarısız",
      });
      continue;
    }

    const enriched: PageCandidate = {
      ...candidate,
      name: validation.page?.name?.trim() || candidate.name,
      pictureUrl:
        (validation.page ? pictureUrlFromRaw(validation.page) : undefined) ?? candidate.pictureUrl,
    };

    const option = toMetaPageOption(enriched);
    diagnosticPages.push({
      id: option.id,
      name: option.name,
      sources: option.sources,
      tasks: option.tasks,
      usableForAds: option.usableForAds,
    });

    if (option.usableForAds) {
      validatedPages.push(option);
    } else {
      diagnosticPages[diagnosticPages.length - 1].excludeReason =
        "user_accounts tasks reklam yetkisi içermiyor";
    }
  }

  let reason: string | undefined;
  if (validatedPages.length === 0) {
    reason = buildEmptyPagesReason({
      stats,
      errors,
      validatedCount: diagnosticPages.filter((p) => !p.excludeReason).length,
      businessId,
    });
  } else if (stats.promotePagesCount > 0) {
    reason = "Page bulundu ve reklam hesabı tarafından kullanılabilir";
  } else if (stats.businessOwnedCount > 0 || stats.businessClientCount > 0) {
    reason = "Business altında Page bulundu";
  }

  const success =
    stats.promotePagesRequestSucceeded ||
    stats.userAccountsRequestSucceeded ||
    stats.businessOwnedRequestSucceeded ||
    stats.businessClientRequestSucceeded;

  const diagnostic: PageResolverDiagnostic = {
    adAccount: {
      normalizedId: accountPath,
      accessible: adAccountAccessible,
    },
    pageDiscovery: stats,
    pages: diagnosticPages,
    errors,
    tokenType: tokenDiagnostics.tokenType,
    missingPermissions: tokenDiagnostics.missingPermissions,
    reason,
  };

  return {
    success,
    pages: validatedPages.sort((a, b) => a.name.localeCompare(b.name, "tr")),
    diagnostic,
    tokenDiagnostics,
  };
}
