import "server-only";

import { getAdAccountProfile } from "@/lib/ad-account-profile-db";
import { graphBaseUrl, metaRequest } from "@/lib/meta";
import {
  classifyMetaError,
  getTokenCapabilityDiagnostics,
  requireMetaConnectionContext,
  type TokenCapabilityDiagnostics,
} from "@/lib/meta-connection-context";
import {
  buildPageDiscoveryCacheKey,
  getCachedPageDiscovery,
  invalidatePageDiscoveryCache,
  setCachedPageDiscovery,
} from "@/lib/page-discovery-cache";
import { normalizeAdAccountId } from "@/utils/ad-account";
import type { MetaPageOption } from "@/types/meta-assets";

const PAGE_FETCH_LIMIT = 500;
const ME_ACCOUNTS_FIELDS = "id,name,tasks,picture,instagram_business_account";
const DIRECT_PAGE_FIELDS = "id,name,instagram_business_account,picture";

const PAGE_AD_TASKS = new Set([
  "ADVERTISE",
  "MANAGE",
  "PROFILE_PLUS_ADVERTISE",
  "PROFILE_PLUS_MANAGE",
  "PROFILE_PLUS_FULL_CONTROL",
]);

export type PageDiscoveryError = {
  source: string;
  code?: number;
  type?: string;
  message: string;
};

export type PageResolverDiagnostic = {
  connectionId: string;
  tokenSubject?: { id: string; name?: string };
  grantedPermissions: string[];
  pagesRequest: {
    succeeded: boolean;
    resultCount: number;
    responseDataParsed: boolean;
    errorMessage?: string;
  };
  pages: Array<{
    id: string;
    name: string;
    tasks: string[];
    usableForAds: boolean;
    hasInstagramBusinessAccount: boolean;
  }>;
  profilePage?: {
    savedPageId?: string;
    directLookupSucceeded: boolean;
    directLookupMessage?: string;
  };
  errors: PageDiscoveryError[];
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
  access_token?: string;
  instagram_business_account?: { id?: string } | string;
  picture?: { data?: { url?: string }; url?: string };
};

type PagedResult<T> = { data?: T[]; paging?: { next?: string } };

function pictureUrlFromRaw(page: RawPage): string | undefined {
  return page.picture?.data?.url ?? page.picture?.url;
}

function extractInstagramBusinessAccountId(page: RawPage): string | undefined {
  const ig = page.instagram_business_account;
  if (!ig) return undefined;
  if (typeof ig === "string") return ig;
  return ig.id;
}

export function computeUsableForAds(tasks?: string[]): boolean {
  if (!tasks || tasks.length === 0) return true;
  return tasks.some((task) => PAGE_AD_TASKS.has(task.toUpperCase()));
}

function mapRawPage(page: RawPage): MetaPageOption | null {
  if (!page?.id) return null;
  const tasks = page.tasks ?? [];
  return {
    id: page.id,
    name: page.name?.trim() || page.id,
    pictureUrl: pictureUrlFromRaw(page),
    instagramBusinessAccountId: extractInstagramBusinessAccountId(page),
    sources: ["user_accounts"],
    tasks,
    usableForAds: computeUsableForAds(tasks),
    available: true,
    source: "user_accounts",
  };
}

async function fetchMeAccounts(
  token: string,
  connectionId: string,
): Promise<{
  pages: MetaPageOption[];
  succeeded: boolean;
  responseDataParsed: boolean;
  error?: PageDiscoveryError;
}> {
  const baseUrl = graphBaseUrl();
  let nextPath: string | null = `me/accounts?fields=${ME_ACCOUNTS_FIELDS}&limit=100`;
  const rawPages: RawPage[] = [];
  let responseDataParsed = false;

  while (nextPath && rawPages.length < PAGE_FETCH_LIMIT) {
    try {
      const response: PagedResult<RawPage> = await metaRequest<PagedResult<RawPage>>(nextPath, {
        token,
        connectionId,
      });
      if (Array.isArray(response.data)) {
        responseDataParsed = true;
        rawPages.push(...response.data);
      } else if (Array.isArray(response)) {
        responseDataParsed = true;
        rawPages.push(...(response as unknown as RawPage[]));
      }
      if (response.paging?.next && rawPages.length < PAGE_FETCH_LIMIT) {
        nextPath = response.paging.next.replace(`${baseUrl}/`, "");
      } else {
        nextPath = null;
      }
    } catch (error) {
      const classified = classifyMetaError(error);
      return {
        pages: [],
        succeeded: false,
        responseDataParsed,
        error: {
          source: "me/accounts",
          code: classified.code,
          type: classified.type,
          message: classified.message,
        },
      };
    }
  }

  const pages: MetaPageOption[] = [];
  for (const raw of rawPages) {
    const mapped = mapRawPage(raw);
    if (mapped) pages.push(mapped);
  }

  return {
    pages,
    succeeded: true,
    responseDataParsed,
  };
}

export async function verifyFacebookPageById(input: {
  connectionId: string;
  pageId: string;
}): Promise<{
  valid: boolean;
  pageId?: string;
  pageName?: string;
  instagramBusinessAccountId?: string;
  pictureUrl?: string;
  error?: PageDiscoveryError;
}> {
  const ctx = await requireMetaConnectionContext({ connectionId: input.connectionId });
  const pageId = input.pageId.trim().replace(/\D/g, "");
  if (!pageId) {
    return {
      valid: false,
      error: { source: "page_direct_lookup", message: "Gecersiz Page ID" },
    };
  }

  try {
    const page = await metaRequest<RawPage>(`${pageId}?fields=${DIRECT_PAGE_FIELDS}`, {
      token: ctx.accessToken,
      connectionId: ctx.connectionId,
    });
    return {
      valid: true,
      pageId: page.id,
      pageName: page.name?.trim() || page.id,
      instagramBusinessAccountId: extractInstagramBusinessAccountId(page),
      pictureUrl: pictureUrlFromRaw(page),
    };
  } catch (error) {
    const classified = classifyMetaError(error);
    return {
      valid: false,
      error: {
        source: `page_direct_lookup:${pageId}`,
        code: classified.code,
        type: classified.type,
        message: classified.message,
      },
    };
  }
}

export async function resolveFacebookPages(input: {
  connectionId: string;
  businessId?: string;
  adAccountId?: string;
  profilePageId?: string;
  forceRefresh?: boolean;
}): Promise<PageResolverResult> {
  const ctx = await requireMetaConnectionContext(input);
  const tokenDiagnostics = await getTokenCapabilityDiagnostics(ctx);
  const errors: PageDiscoveryError[] = [];

  let savedProfilePageId = input.profilePageId?.trim();
  if (!savedProfilePageId && input.adAccountId) {
    const profile = await getAdAccountProfile(ctx.connectionId, input.adAccountId);
    savedProfilePageId = profile?.defaultPageId?.trim();
  }

  let tokenSubject: { id: string; name?: string } | undefined;
  try {
    const me = await metaRequest<{ id: string; name?: string }>("me?fields=id,name", {
      token: ctx.accessToken,
      connectionId: ctx.connectionId,
    });
    tokenSubject = { id: me.id, name: me.name };
    if (ctx.metaUserId && ctx.metaUserId !== me.id) {
      errors.push({
        source: "connection_token_subject",
        message: "Connection kaydindaki metaUserId ile token subject ID eslesmiyor",
      });
    }
  } catch (error) {
    const classified = classifyMetaError(error);
    errors.push({
      source: "me",
      code: classified.code,
      type: classified.type,
      message: classified.message,
    });
  }

  const cacheKey =
    tokenSubject?.id &&
    buildPageDiscoveryCacheKey({
      connectionId: ctx.connectionId,
      tokenSubjectId: tokenSubject.id,
      businessId: input.businessId ?? ctx.metaBusinessId,
      adAccountId: input.adAccountId ? normalizeAdAccountId(input.adAccountId) : undefined,
    });

  if (input.forceRefresh && cacheKey) {
    invalidatePageDiscoveryCache({
      connectionId: ctx.connectionId,
      tokenSubjectId: tokenSubject?.id,
      businessId: input.businessId ?? ctx.metaBusinessId,
      adAccountId: input.adAccountId,
    });
  }

  let pages: MetaPageOption[] = [];
  let pagesRequest: PageResolverDiagnostic["pagesRequest"] = {
    succeeded: false,
    resultCount: 0,
    responseDataParsed: false,
  };

  if (cacheKey && !input.forceRefresh) {
    const cached = getCachedPageDiscovery(cacheKey);
    if (cached) {
      pages = cached.pages;
      pagesRequest = { ...cached.pagesRequest };
    }
  }

  if (pages.length === 0 && tokenSubject && !pagesRequest.succeeded) {
    const meAccounts = await fetchMeAccounts(ctx.accessToken, ctx.connectionId);
    pages = meAccounts.pages;
    pagesRequest = {
      succeeded: meAccounts.succeeded,
      resultCount: meAccounts.pages.length,
      responseDataParsed: meAccounts.responseDataParsed,
      errorMessage: meAccounts.error?.message,
    };
    if (meAccounts.error) {
      errors.push(meAccounts.error);
    }
    if (cacheKey && meAccounts.succeeded && meAccounts.pages.length > 0) {
      setCachedPageDiscovery(cacheKey, {
        pages: meAccounts.pages,
        tokenSubjectId: tokenSubject.id,
        pagesRequest: {
          succeeded: meAccounts.succeeded,
          resultCount: meAccounts.pages.length,
          responseDataParsed: meAccounts.responseDataParsed,
        },
      });
    }
  }

  const profilePageMeta = {
    savedPageId: savedProfilePageId,
    directLookupSucceeded: false,
    directLookupMessage: undefined as string | undefined,
  };

  if (savedProfilePageId && !pages.some((p) => p.id === savedProfilePageId)) {
    const verified = await verifyFacebookPageById({
      connectionId: ctx.connectionId,
      pageId: savedProfilePageId,
    });
    if (verified.valid && verified.pageId) {
      profilePageMeta.directLookupSucceeded = true;
      pages.push({
        id: verified.pageId,
        name: verified.pageName ?? verified.pageId,
        pictureUrl: verified.pictureUrl,
        instagramBusinessAccountId: verified.instagramBusinessAccountId,
        sources: ["user_accounts"],
        tasks: [],
        usableForAds: true,
        available: true,
        source: "user_accounts",
      });
    } else {
      profilePageMeta.directLookupSucceeded = false;
      profilePageMeta.directLookupMessage = verified.error?.message ?? "Page ID dogrulanamadi";
      if (verified.error) errors.push(verified.error);
    }
  }

  const byId = new Map<string, MetaPageOption>();
  for (const page of pages) {
    const existing = byId.get(page.id);
    if (!existing) {
      byId.set(page.id, page);
      continue;
    }
    byId.set(page.id, {
      ...existing,
      name: existing.name === existing.id && page.name !== page.id ? page.name : existing.name,
      pictureUrl: existing.pictureUrl ?? page.pictureUrl,
      instagramBusinessAccountId: existing.instagramBusinessAccountId ?? page.instagramBusinessAccountId,
      tasks: [...new Set([...(existing.tasks ?? []), ...(page.tasks ?? [])])],
      usableForAds: existing.usableForAds || page.usableForAds,
    });
  }

  const validatedPages = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const diagnosticPages = validatedPages.map((page) => ({
    id: page.id,
    name: page.name,
    tasks: page.tasks ?? [],
    usableForAds: page.usableForAds,
    hasInstagramBusinessAccount: Boolean(page.instagramBusinessAccountId),
  }));

  const reason =
    validatedPages.length === 0
      ? pagesRequest.errorMessage ?? "Kullanilabilir Facebook Page bulunamadi"
      : validatedPages.length === 1
        ? "Tek Page bulundu; otomatik secilebilir"
        : `${validatedPages.length} Page bulundu`;

  const diagnostic: PageResolverDiagnostic = {
    connectionId: ctx.connectionId,
    tokenSubject,
    grantedPermissions: tokenDiagnostics.grantedPermissions,
    pagesRequest,
    pages: diagnosticPages,
    profilePage: profilePageMeta,
    errors,
    reason,
  };

  return {
    success: pagesRequest.succeeded || profilePageMeta.directLookupSucceeded,
    pages: validatedPages,
    diagnostic,
    tokenDiagnostics,
  };
}
