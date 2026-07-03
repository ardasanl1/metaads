import "server-only";

type CacheEntry<T> = { value: T; expiresAt: number };

const snapshotCache = new Map<string, CacheEntry<unknown>>();
const locationQueryCache = new Map<string, CacheEntry<unknown>>();

export const CACHE_TTL_MS = {
  adAccount: 15 * 60 * 1000,
  pages: 10 * 60 * 1000,
  instagram: 10 * 60 * 1000,
  pixel: 5 * 60 * 1000,
  instantForm: 5 * 60 * 1000,
  catalog: 5 * 60 * 1000,
  locationQuery: 2 * 60 * 1000,
} as const;

export function buildSnapshotCacheKey(input: {
  connectionId: string;
  businessId?: string;
  adAccountId: string;
  recipeId: string;
}): string {
  return [
    input.connectionId,
    input.businessId?.trim() || "",
    input.adAccountId,
    input.recipeId,
  ].join(":");
}

export function getCachedSnapshot<T>(key: string): T | null {
  const entry = snapshotCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    snapshotCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedSnapshot<T>(key: string, value: T, ttlMs: number): void {
  snapshotCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateSnapshotCache(prefix?: {
  connectionId?: string;
  businessId?: string;
  adAccountId?: string;
  recipeId?: string;
}): void {
  if (!prefix) {
    snapshotCache.clear();
    return;
  }
  const parts = [
    prefix.connectionId ?? "",
    prefix.businessId?.trim() || "",
    prefix.adAccountId ?? "",
    prefix.recipeId ?? "",
  ];
  for (const key of snapshotCache.keys()) {
    const matches = parts.every((part, index) => !part || key.split(":")[index] === part);
    if (matches) snapshotCache.delete(key);
  }
}

export function buildLocationCacheKey(input: {
  connectionId: string;
  query: string;
  countryCode?: string;
}): string {
  return [input.connectionId, input.countryCode?.trim().toUpperCase() || "", input.query.trim().toLowerCase()].join(":");
}

export function getCachedLocationQuery<T>(key: string): T | null {
  const entry = locationQueryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    locationQueryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedLocationQuery<T>(key: string, value: T): void {
  locationQueryCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS.locationQuery });
}

export function invalidateLocationCache(connectionId?: string): void {
  if (!connectionId) {
    locationQueryCache.clear();
    return;
  }
  for (const key of locationQueryCache.keys()) {
    if (key.startsWith(`${connectionId}:`)) locationQueryCache.delete(key);
  }
}
