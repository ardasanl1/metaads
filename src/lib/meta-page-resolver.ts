import "server-only";

import { getAdAccountProfile } from "@/lib/ad-account-profile-db";
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
const ME_ACCOUNTS_FIELDS = "id,name,tasks,picture,instagram_business_account";
const BUSINESS_PAGE_FIELDS = "id,name,picture,instagram_business_account";
const DIRECT_PAGE_FIELDS = "id,name,instagram_business_account,picture";

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
  businessesCount: number;
  businessOwnedRequestSucceeded: boolean;
  businessOwnedCount: number;
  businessClientRequestSucceeded: boolean;
  businessClientCount: number;
  mergedPageCount: number;
};

export type PageResolverStatusCode =
  | "me_accounts_success_empty"
  | "me_accounts_permission_error"
  | "me_accounts_token_error"
  | "me_accounts_other_error"
  | "me_accounts_success"
  | "wrong_token_type"
  | "token_invalid"
  | "profile_page_verified"
  | "profile_page_verification_failed"
  | "promote_pages_fallback_empty"
  | "promote_pages_fallback_success"
  | "business_pages_merged"
  | "connection_token_subject_resolved";

export type PageResolverDiagnostic = {
  connectionId: string;
  tokenSubject?: { id: string; name?: string };
  adAccount: {
    normalizedId: string;
    accessible: boolean;
  };
  meAccounts: {
    requestSucceeded: boolean;
    resultCount: number;
    empty: boolean;
    errorMessage?: string;
  };
  promotePages: {
    requestSucceeded: boolean;
    resultCount: number;
    empty: boolean;
    errorMessage?: string;
  };
  profilePage: {
    savedPageId?: string;
    directLookupSucceeded: boolean;
    directLookupMessage?: string;
  };
  pageDiscovery: PageDiscoveryStats;
  pages: Array<{
    id: string;
    name: string;
    sources: MetaPageSource[];
    tasks?: string[];
    usableForAds: boolean;
  }>;
  errors: PageDiscoveryError[];
  status: PageResolverStatusCode[];
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
): Promise<{ items: T[]; error?: PageDiscoveryError; succeeded: boolean }> {
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
        succeeded: false,
        error: {
          source: initialPath.split("?")[0],
          code: classified.code,
          type: classified.type,
          message: classified.message,
        },
      };
    }
  }

  return { items: results.slice(0, max), succeeded: true };
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

function toMetaPageOption(candidate: PageCandidate): MetaPageOption {
  const primarySource = candidate.sources[0];
  return {
    id: candidate.id,
    name: candidate.name,
    pictureUrl: candidate.pictureUrl,
    instagramBusinessAccountId: candidate.instagramBusinessAccountId,
    sources: candidate.sources,
    tasks: candidate.tasks,
    usableForAds: true,
    available: true,
    source: primarySource === "ad_account_promote_pages" ? "ad_account" : primarySource,
  };
}

function isPermissionError(error: PageDiscoveryError): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("permission") ||
    error.code === 10 ||
    error.code === 200 ||
    error.type === "OAuthException"
  );
}

function isTokenError(error: PageDiscoveryError): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("invalid oauth") ||
    msg.includes("expired") ||
    msg.includes("session has") ||
    error.code === 190 ||
    error.code === 102
  );
}

async function fetchPromotePagesFallback(
  accountPath: string,
  token: string,
  connectionId: string,
): Promise<{ pages: RawPage[]; error?: PageDiscoveryError; succeeded: boolean }> {
  try {
    const account = await metaRequest<{
      promote_pages?: { data?: RawPage[] };
    }>(`${accountPath}?fields=promote_pages{id,name,picture,instagram_business_account{id}}`, {
      token,
      connectionId,
    });
    return {
      pages: account.promote_pages?.data ?? [],
      succeeded: true,
    };
  } catch (error) {
    const classified = classifyMetaError(error);
    const fallback = await fetchPagedWithToken<RawPage>(
      `${accountPath}/promote_pages?fields=id,name,picture,instagram_business_account{id}&limit=100`,
      token,
      connectionId,
    );
    if (fallback.succeeded) {
      return { pages: fallback.items, succeeded: true };
    }
    return {
      pages: fallback.items,
      succeeded: false,
      error: fallback.error ?? {
        source: "ad_account_promote_pages",
        code: classified.code,
        type: classified.type,
        message: classified.message,
      },
    };
  }
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
    const page = await metaRequest<RawPage & { access_token?: string }>(
      `${pageId}?fields=${DIRECT_PAGE_FIELDS},access_token`,
      { token: ctx.accessToken, connectionId: ctx.connectionId },
    );
    return {
      valid: true,
      pageId: page.id,
      pageName: page.name?.trim() || page.id,
      instagramBusinessAccountId: page.instagram_business_account?.id,
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

function buildEmptyPagesReason(input: {
  status: PageResolverStatusCode[];
  meAccountsEmpty: boolean;
  meAccountsError?: PageDiscoveryError;
  profileVerified: boolean;
  promotePagesEmpty: boolean;
  mergedCount: number;
}): string {
  if (input.status.includes("token_invalid")) {
    return "Token gecersiz veya suresi dolmus";
  }
  if (input.status.includes("me_accounts_permission_error")) {
    return "Meta /me/accounts istegi permission hatasi verdi";
  }
  if (input.status.includes("profile_page_verified") && input.mergedCount > 0) {
    return "Kayitli Page ID dogrudan dogrulandi";
  }
  if (input.status.includes("profile_page_verification_failed") && input.mergedCount === 0) {
    return "Kayitli Page ID dogrulanamadi";
  }
  if (input.status.includes("me_accounts_success_empty") && input.mergedCount === 0) {
    return "Meta /me/accounts istegi basarili ancak data bos dondu";
  }
  if (input.mergedCount === 0) {
    return "Kullanilabilir Facebook Page bulunamadi";
  }
  return "Facebook Page bulundu";
}

export async function resolveFacebookPages(input: {
  connectionId: string;
  businessId?: string;
  adAccountId?: string;
  profilePageId?: string;
}): Promise<PageResolverResult> {
  const ctx = await requireMetaConnectionContext(input);
  const tokenDiagnostics = await getTokenCapabilityDiagnostics(ctx);

  const accountPath = input.adAccountId ? normalizeAdAccountId(input.adAccountId) : "";
  const errors: PageDiscoveryError[] = [];
  const status: PageResolverStatusCode[] = [];
  const byId = new Map<string, PageCandidate>();

  let savedProfilePageId = input.profilePageId?.trim();
  if (!savedProfilePageId && input.adAccountId) {
    const profile = await getAdAccountProfile(ctx.connectionId, input.adAccountId);
    savedProfilePageId = profile?.defaultPageId?.trim();
  }

  const stats: PageDiscoveryStats = {
    promotePagesRequestSucceeded: false,
    promotePagesCount: 0,
    userAccountsRequestSucceeded: false,
    userAccountsCount: 0,
    businessesCount: 0,
    businessOwnedRequestSucceeded: false,
    businessOwnedCount: 0,
    businessClientRequestSucceeded: false,
    businessClientCount: 0,
    mergedPageCount: 0,
  };

  const isSystemUser = tokenDiagnostics.tokenType === "system_user";

  let tokenSubject: { id: string; name?: string } | undefined;
  try {
    const me = await metaRequest<{ id: string; name?: string }>("me?fields=id,name", {
      token: ctx.accessToken,
      connectionId: ctx.connectionId,
    });
    tokenSubject = { id: me.id, name: me.name };
    status.push("connection_token_subject_resolved");
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
    status.push("token_invalid");
  }

  const meAccountsMeta = {
    requestSucceeded: false,
    resultCount: 0,
    empty: true,
    errorMessage: undefined as string | undefined,
  };

  if (!status.includes("token_invalid")) {
    const userAccounts = await fetchPagedWithToken<RawPage>(
      `me/accounts?fields=${ME_ACCOUNTS_FIELDS}&limit=100`,
      ctx.accessToken,
      ctx.connectionId,
    );

    if (userAccounts.error) {
      errors.push({ ...userAccounts.error, source: "user_accounts" });
      meAccountsMeta.errorMessage = userAccounts.error.message;
      stats.userAccountsRequestSucceeded = false;

      if (isPermissionError(userAccounts.error)) {
        status.push("me_accounts_permission_error");
      } else if (isTokenError(userAccounts.error)) {
        status.push("me_accounts_token_error");
        status.push("token_invalid");
      } else {
        status.push("me_accounts_other_error");
      }
    } else {
      stats.userAccountsRequestSucceeded = true;
      meAccountsMeta.requestSucceeded = true;
      stats.userAccountsCount = userAccounts.items.length;
      meAccountsMeta.resultCount = userAccounts.items.length;

      if (userAccounts.items.length === 0) {
        status.push("me_accounts_success_empty");
        meAccountsMeta.empty = true;
      } else {
        status.push("me_accounts_success");
        meAccountsMeta.empty = false;
      }

      for (const page of userAccounts.items) {
        if (isSystemUser) continue;
        const mapped = mapRawPage(page, "user_accounts");
        if (!mapped) continue;
        byId.set(mapped.id, mergeCandidate(byId.get(mapped.id), mapped));
      }
    }
  }

  if (!status.includes("token_invalid")) {
    type RawBusiness = { id: string; name?: string };
    const businesses = await fetchPagedWithToken<RawBusiness>(
      "me/businesses?fields=id,name&limit=100",
      ctx.accessToken,
      ctx.connectionId,
    );

    if (businesses.error) {
      errors.push({ ...businesses.error, source: "me/businesses" });
    } else {
      stats.businessesCount = businesses.items.length;
      let ownedTotal = 0;
      let clientTotal = 0;
      let ownedOk = true;
      let clientOk = true;

      for (const business of businesses.items) {
        if (!business.id) continue;

        const owned = await fetchPagedWithToken<RawPage>(
          `${business.id}/owned_pages?fields=${BUSINESS_PAGE_FIELDS}&limit=100`,
          ctx.accessToken,
          ctx.connectionId,
        );
        if (owned.error) {
          errors.push({ ...owned.error, source: `${business.id}/owned_pages` });
          ownedOk = false;
        } else {
          ownedTotal += owned.items.length;
          for (const page of owned.items) {
            const mapped = mapRawPage(page, "business_owned");
            if (!mapped) continue;
            byId.set(mapped.id, mergeCandidate(byId.get(mapped.id), mapped));
          }
        }

        const client = await fetchPagedWithToken<RawPage>(
          `${business.id}/client_pages?fields=${BUSINESS_PAGE_FIELDS}&limit=100`,
          ctx.accessToken,
          ctx.connectionId,
        );
        if (client.error) {
          errors.push({ ...client.error, source: `${business.id}/client_pages` });
          clientOk = false;
        } else {
          clientTotal += client.items.length;
          for (const page of client.items) {
            const mapped = mapRawPage(page, "business_client");
            if (!mapped) continue;
            byId.set(mapped.id, mergeCandidate(byId.get(mapped.id), mapped));
          }
        }
      }

      stats.businessOwnedRequestSucceeded = ownedOk;
      stats.businessOwnedCount = ownedTotal;
      stats.businessClientRequestSucceeded = clientOk;
      stats.businessClientCount = clientTotal;
      if (ownedTotal > 0 || clientTotal > 0) {
        status.push("business_pages_merged");
      }
    }
  }

  const profilePageMeta = {
    savedPageId: savedProfilePageId,
    directLookupSucceeded: false,
    directLookupMessage: undefined as string | undefined,
  };

  if (savedProfilePageId) {
    const verified = await verifyFacebookPageById({
      connectionId: ctx.connectionId,
      pageId: savedProfilePageId,
    });
    if (verified.valid && verified.pageId) {
      profilePageMeta.directLookupSucceeded = true;
      status.push("profile_page_verified");
      const mapped = mapRawPage(
        {
          id: verified.pageId,
          name: verified.pageName,
          instagram_business_account: verified.instagramBusinessAccountId
            ? { id: verified.instagramBusinessAccountId }
            : undefined,
          picture: verified.pictureUrl ? { url: verified.pictureUrl } : undefined,
        },
        "user_accounts",
      );
      if (mapped) {
        byId.set(mapped.id, mergeCandidate(byId.get(mapped.id), mapped));
      }
    } else {
      profilePageMeta.directLookupSucceeded = false;
      profilePageMeta.directLookupMessage = verified.error?.message ?? "Page ID dogrulanamadi";
      status.push("profile_page_verification_failed");
      if (verified.error) errors.push(verified.error);
    }
  }

  const promotePagesMeta = {
    requestSucceeded: false,
    resultCount: 0,
    empty: true,
    errorMessage: undefined as string | undefined,
  };

  let adAccountAccessible = false;
  const shouldTryPromoteFallback =
    byId.size === 0 && Boolean(accountPath) && !isSystemUser;

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

    if (adAccountAccessible && shouldTryPromoteFallback) {
      const promote = await fetchPromotePagesFallback(accountPath, ctx.accessToken, ctx.connectionId);
      if (promote.error) {
        errors.push(promote.error);
        promotePagesMeta.errorMessage = promote.error.message;
        stats.promotePagesRequestSucceeded = false;
        promotePagesMeta.requestSucceeded = false;
      } else {
        stats.promotePagesRequestSucceeded = true;
        promotePagesMeta.requestSucceeded = true;
      }
      stats.promotePagesCount = promote.pages.length;
      promotePagesMeta.resultCount = promote.pages.length;
      promotePagesMeta.empty = promote.pages.length === 0;

      if (promote.pages.length > 0) {
        status.push("promote_pages_fallback_success");
        for (const page of promote.pages) {
          const mapped = mapRawPage(page, "ad_account_promote_pages");
          if (!mapped) continue;
          byId.set(mapped.id, mergeCandidate(byId.get(mapped.id), mapped));
        }
      } else if (promote.succeeded) {
        status.push("promote_pages_fallback_empty");
      }
    }
  }

  if (
    tokenDiagnostics.tokenType === "system_user" &&
    !tokenDiagnostics.grantedPermissions.includes("pages_show_list")
  ) {
    status.push("wrong_token_type");
  }

  stats.mergedPageCount = byId.size;

  const diagnosticPages: PageResolverDiagnostic["pages"] = [];
  const validatedPages: MetaPageOption[] = [];

  for (const candidate of byId.values()) {
    const option = toMetaPageOption(candidate);
    diagnosticPages.push({
      id: option.id,
      name: option.name,
      sources: option.sources,
      tasks: option.tasks,
      usableForAds: true,
    });
    validatedPages.push(option);
  }

  const reason =
    validatedPages.length === 0
      ? buildEmptyPagesReason({
          status,
          meAccountsEmpty: meAccountsMeta.empty,
          meAccountsError: errors.find((e) => e.source === "user_accounts"),
          profileVerified: profilePageMeta.directLookupSucceeded,
          promotePagesEmpty: promotePagesMeta.empty,
          mergedCount: byId.size,
        })
      : validatedPages.length === 1
        ? "Tek Page bulundu; otomatik secilebilir"
        : `${validatedPages.length} Page bulundu`;

  const requestSucceeded =
    stats.userAccountsRequestSucceeded ||
    stats.businessOwnedRequestSucceeded ||
    stats.businessClientRequestSucceeded ||
    profilePageMeta.directLookupSucceeded ||
    stats.promotePagesRequestSucceeded ||
    Boolean(tokenSubject);

  const diagnostic: PageResolverDiagnostic = {
    connectionId: ctx.connectionId,
    tokenSubject,
    adAccount: {
      normalizedId: accountPath,
      accessible: adAccountAccessible,
    },
    meAccounts: meAccountsMeta,
    promotePages: promotePagesMeta,
    profilePage: profilePageMeta,
    pageDiscovery: stats,
    pages: diagnosticPages,
    errors,
    status,
    tokenType: tokenDiagnostics.tokenType,
    missingPermissions: tokenDiagnostics.missingPermissions,
    reason,
  };

  return {
    success: requestSucceeded,
    pages: validatedPages.sort((a, b) => a.name.localeCompare(b.name, "tr")),
    diagnostic,
    tokenDiagnostics,
  };
}
