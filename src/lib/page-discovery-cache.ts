import "server-only";

import type { MetaPageOption } from "@/types/meta-assets";
import { CACHE_TTL_MS } from "@/lib/account-snapshot-cache";

type CacheEntry = {
  pages: MetaPageOption[];
  tokenSubjectId: string;
  pagesRequest: {
    succeeded: boolean;
    resultCount: number;
    responseDataParsed: boolean;
  };
  expiresAt: number;
};

const pageDiscoveryCache = new Map<string, CacheEntry>();

export function buildPageDiscoveryCacheKey(input: {
  connectionId: string;
  tokenSubjectId: string;
  businessId?: string;
  adAccountId?: string;
}): string {
  return [
    input.connectionId,
    input.tokenSubjectId,
    input.businessId?.trim() || "",
    input.adAccountId?.trim() || "",
  ].join(":");
}

export function getCachedPageDiscovery(key: string): CacheEntry | null {
  const entry = pageDiscoveryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    pageDiscoveryCache.delete(key);
    return null;
  }
  if (entry.pagesRequest.resultCount === 0 && entry.pages.length === 0) {
    pageDiscoveryCache.delete(key);
    return null;
  }
  return entry;
}

export function setCachedPageDiscovery(
  key: string,
  value: Omit<CacheEntry, "expiresAt">,
): void {
  if (value.pages.length === 0 && value.pagesRequest.resultCount === 0) {
    return;
  }
  pageDiscoveryCache.set(key, {
    ...value,
    expiresAt: Date.now() + CACHE_TTL_MS.pages,
  });
}

export function invalidatePageDiscoveryCache(prefix?: {
  connectionId?: string;
  tokenSubjectId?: string;
  businessId?: string;
  adAccountId?: string;
}): void {
  if (!prefix) {
    pageDiscoveryCache.clear();
    return;
  }
  const parts = [
    prefix.connectionId ?? "",
    prefix.tokenSubjectId ?? "",
    prefix.businessId?.trim() || "",
    prefix.adAccountId?.trim() || "",
  ];
  for (const key of pageDiscoveryCache.keys()) {
    const matches = parts.every((part, index) => !part || key.split(":")[index] === part);
    if (matches) pageDiscoveryCache.delete(key);
  }
}
