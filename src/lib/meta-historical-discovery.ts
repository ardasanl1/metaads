import "server-only";

import { graphBaseUrl, metaRequest } from "@/lib/meta";
import { classifyMetaError } from "@/lib/meta-connection-context";
import { normalizeAdAccountId } from "@/utils/ad-account";
import { extractDomain, normalizeWebsiteUrl } from "@/utils/url-normalize";
import type {
  PageSource,
  PixelSource,
  ProfileAssetConfidence,
  ProfileInstagramCandidate,
  ProfilePageCandidate,
  ProfilePixelCandidate,
  ProfileWebsiteCandidate,
  WebsiteSource,
} from "@/types/ad-account-profile";

const SCAN_LIMIT = 200;
const ACTIVE_STATUSES = new Set(["ACTIVE", "PAUSED", "PENDING_REVIEW", "PREAPPROVED"]);

type Paged<T> = { data?: T[]; paging?: { next?: string } };

export type HistoricalDiscoveryResult = {
  pages: ProfilePageCandidate[];
  instagramAccounts: ProfileInstagramCandidate[];
  pixels: ProfilePixelCandidate[];
  websites: ProfileWebsiteCandidate[];
  adsScanned: number;
  adSetsScanned: number;
  creativesScanned: number;
};

type RawAd = {
  id: string;
  name?: string;
  creative?: { id?: string } | string;
  adset_id?: string;
  campaign_id?: string;
  effective_status?: string;
  updated_time?: string;
  conversion_domain?: string;
};

type RawCreative = {
  id: string;
  name?: string;
  object_story_id?: string;
  object_story_spec?: Record<string, unknown>;
  asset_feed_spec?: Record<string, unknown>;
  effective_instagram_story_id?: string;
  effective_instagram_media_id?: string;
  instagram_permalink_url?: string;
  status?: string;
};

type RawAdSet = {
  id: string;
  name?: string;
  promoted_object?: Record<string, unknown>;
  optimization_goal?: string;
  destination_type?: string;
  effective_status?: string;
  updated_time?: string;
  campaign_id?: string;
};

type RawCustomConversion = {
  id: string;
  name?: string;
  custom_event_type?: string;
  pixel?: { id?: string; name?: string } | string;
  data_sources?: unknown;
  last_fired_time?: string;
  is_archived?: boolean;
};

async function fetchPaged<T>(
  path: string,
  token: string,
  connectionId: string,
  max = SCAN_LIMIT,
): Promise<T[]> {
  const base = graphBaseUrl();
  let next: string | null = path;
  const items: T[] = [];
  while (next && items.length < max) {
    const res: Paged<T> = await metaRequest<Paged<T>>(next, { token, connectionId });
    if (res.data) items.push(...res.data);
    next =
      res.paging?.next && items.length < max
        ? res.paging.next.replace(`${base}/`, "")
        : null;
  }
  return items.slice(0, max);
}

function parsePageIdFromObjectStoryId(objectStoryId?: string): string | null {
  if (!objectStoryId?.trim()) return null;
  const match = /^(\d+)_/.exec(objectStoryId.trim());
  return match?.[1] ?? null;
}

function collectUrlsFromObject(value: unknown, urls: string[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectUrlsFromObject(item, urls);
    return;
  }
  const obj = value as Record<string, unknown>;
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string") {
      if (key === "link" || key === "website_url" || key === "deeplink_url" || key.endsWith("_link")) {
        urls.push(val);
      }
    } else {
      collectUrlsFromObject(val, urls);
    }
  }
}

function isRecent(updatedTime?: string, days = 180): boolean {
  if (!updatedTime) return false;
  const ts = new Date(updatedTime).getTime();
  return Date.now() - ts < days * 24 * 60 * 60 * 1000;
}

function confidenceForAdStatus(status?: string, updatedTime?: string): ProfileAssetConfidence {
  if (status && ACTIVE_STATUSES.has(status)) {
    return isRecent(updatedTime, 90) ? 90 : 80;
  }
  return 50;
}

function mergePage(
  map: Map<string, ProfilePageCandidate>,
  input: Omit<ProfilePageCandidate, "sources" | "confidence" | "usageCount"> & {
    source: PageSource;
    confidence: ProfileAssetConfidence;
    usageDelta?: number;
    lastUsedAt?: string;
  },
): void {
  const existing = map.get(input.id);
  if (!existing) {
    map.set(input.id, {
      id: input.id,
      name: input.name,
      pictureUrl: input.pictureUrl,
      instagramBusinessAccountId: input.instagramBusinessAccountId,
      sources: [input.source],
      confidence: input.confidence,
      usageCount: input.usageDelta ?? 1,
      lastUsedAt: input.lastUsedAt,
      usableForAds: input.usableForAds,
    });
    return;
  }
  if (!existing.sources.includes(input.source)) existing.sources.push(input.source);
  existing.confidence = Math.max(existing.confidence, input.confidence) as ProfileAssetConfidence;
  existing.usageCount += input.usageDelta ?? 1;
  if (input.lastUsedAt && (!existing.lastUsedAt || input.lastUsedAt > existing.lastUsedAt)) {
    existing.lastUsedAt = input.lastUsedAt;
  }
  if (input.name && input.name !== input.id) existing.name = input.name;
  existing.pictureUrl = existing.pictureUrl ?? input.pictureUrl;
  existing.instagramBusinessAccountId =
    existing.instagramBusinessAccountId ?? input.instagramBusinessAccountId;
  existing.usableForAds = existing.usableForAds || input.usableForAds;
}

function mergePixel(
  map: Map<string, ProfilePixelCandidate>,
  input: {
    id: string;
    name: string;
    source: PixelSource;
    confidence: ProfileAssetConfidence;
    eventType?: string;
    lastUsedAt?: string;
    lastFiredTime?: string;
    usageDelta?: number;
  },
): void {
  const existing = map.get(input.id);
  if (!existing) {
    map.set(input.id, {
      id: input.id,
      name: input.name,
      sources: [input.source],
      confidence: input.confidence,
      eventType: input.eventType,
      usageCount: input.usageDelta ?? 1,
      lastUsedAt: input.lastUsedAt,
      lastFiredTime: input.lastFiredTime,
    });
    return;
  }
  if (!existing.sources.includes(input.source)) existing.sources.push(input.source);
  existing.confidence = Math.max(existing.confidence, input.confidence) as ProfileAssetConfidence;
  existing.usageCount += input.usageDelta ?? 1;
  if (input.eventType === "PURCHASE") existing.eventType = "PURCHASE";
  else if (!existing.eventType && input.eventType) existing.eventType = input.eventType;
  if (input.lastUsedAt && (!existing.lastUsedAt || input.lastUsedAt > existing.lastUsedAt)) {
    existing.lastUsedAt = input.lastUsedAt;
  }
  existing.lastFiredTime = existing.lastFiredTime ?? input.lastFiredTime;
  if (input.name && input.name !== input.id) existing.name = input.name;
}

function mergeWebsite(
  map: Map<string, ProfileWebsiteCandidate>,
  input: {
    url: string;
    source: WebsiteSource;
    confidence: ProfileAssetConfidence;
    lastUsedAt?: string;
    usageDelta?: number;
  },
): void {
  const normalized = normalizeWebsiteUrl(input.url);
  const domain = normalized ? extractDomain(normalized) : null;
  if (!normalized || !domain) return;
  const key = normalized;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      url: normalized,
      domain,
      sources: [input.source],
      confidence: input.confidence,
      usageCount: input.usageDelta ?? 1,
      lastUsedAt: input.lastUsedAt,
    });
    return;
  }
  if (!existing.sources.includes(input.source)) existing.sources.push(input.source);
  existing.confidence = Math.max(existing.confidence, input.confidence) as ProfileAssetConfidence;
  existing.usageCount += input.usageDelta ?? 1;
  if (input.lastUsedAt && (!existing.lastUsedAt || input.lastUsedAt > existing.lastUsedAt)) {
    existing.lastUsedAt = input.lastUsedAt;
  }
}

function mergeInstagram(
  map: Map<string, ProfileInstagramCandidate>,
  input: {
    id: string;
    username?: string;
    name?: string;
    pageId?: string;
    source: string;
    confidence: ProfileAssetConfidence;
    lastUsedAt?: string;
    usageDelta?: number;
  },
): void {
  const existing = map.get(input.id);
  if (!existing) {
    map.set(input.id, {
      id: input.id,
      username: input.username,
      name: input.name,
      pageId: input.pageId,
      sources: [input.source],
      confidence: input.confidence,
      usageCount: input.usageDelta ?? 1,
      lastUsedAt: input.lastUsedAt,
    });
    return;
  }
  if (!existing.sources.includes(input.source)) existing.sources.push(input.source);
  existing.confidence = Math.max(existing.confidence, input.confidence) as ProfileAssetConfidence;
  existing.usageCount += input.usageDelta ?? 1;
  existing.username = existing.username ?? input.username;
  existing.pageId = existing.pageId ?? input.pageId;
  if (input.lastUsedAt && (!existing.lastUsedAt || input.lastUsedAt > existing.lastUsedAt)) {
    existing.lastUsedAt = input.lastUsedAt;
  }
}

async function fetchCreativeBatch(
  creativeIds: string[],
  token: string,
  connectionId: string,
): Promise<RawCreative[]> {
  const fields =
    "id,name,object_story_id,object_story_spec,asset_feed_spec,effective_instagram_story_id,effective_instagram_media_id,instagram_permalink_url,status";
  const unique = [...new Set(creativeIds.filter(Boolean))].slice(0, 50);
  const results: RawCreative[] = [];
  for (const id of unique) {
    try {
      const creative = await metaRequest<RawCreative>(`${id}?fields=${fields}`, {
        token,
        connectionId,
      });
      results.push(creative);
    } catch {
      // skip invalid creative
    }
  }
  return results;
}

export async function discoverFromAdHistory(input: {
  connectionId: string;
  adAccountId: string;
  token: string;
  needsPage?: boolean;
  needsPixel?: boolean;
  needsWebsite?: boolean;
  needsInstagram?: boolean;
}): Promise<HistoricalDiscoveryResult> {
  const accountPath = normalizeAdAccountId(input.adAccountId);
  const pageMap = new Map<string, ProfilePageCandidate>();
  const pixelMap = new Map<string, ProfilePixelCandidate>();
  const websiteMap = new Map<string, ProfileWebsiteCandidate>();
  const igMap = new Map<string, ProfileInstagramCandidate>();

  const adFields =
    "id,name,creative{id},adset_id,campaign_id,effective_status,updated_time,conversion_domain";
  const ads = await fetchPaged<RawAd>(
    `${accountPath}/ads?fields=${adFields}&limit=100`,
    input.token,
    input.connectionId,
  );

  const creativeIds = ads
    .map((ad) => (typeof ad.creative === "object" ? ad.creative?.id : ad.creative))
    .filter((id): id is string => Boolean(id));

  const creatives = await fetchCreativeBatch(creativeIds, input.token, input.connectionId);

  for (const ad of ads) {
    const conf = confidenceForAdStatus(ad.effective_status, ad.updated_time);
    if (input.needsWebsite && ad.conversion_domain) {
      const domainUrl = `https://${ad.conversion_domain}`;
      mergeWebsite(websiteMap, {
        url: domainUrl,
        source: "historical_ad",
        confidence: conf,
        lastUsedAt: ad.updated_time,
      });
    }
  }

  for (const creative of creatives) {
    const parentAd = ads.find((ad) => {
      const cid = typeof ad.creative === "object" ? ad.creative?.id : ad.creative;
      return cid === creative.id;
    });
    const conf = confidenceForAdStatus(parentAd?.effective_status, parentAd?.updated_time);
    const lastUsed = parentAd?.updated_time;

    if (input.needsPage || input.needsInstagram) {
      const spec = creative.object_story_spec as Record<string, unknown> | undefined;
      const pageId =
        (spec?.page_id as string | undefined) ??
        parsePageIdFromObjectStoryId(creative.object_story_id);

      if (pageId && input.needsPage) {
        mergePage(pageMap, {
          id: pageId,
          name: creative.name?.trim() || pageId,
          source: "historical_creative",
          confidence: conf,
          lastUsedAt: lastUsed,
          usableForAds: true,
        });
      }

      const igActor = spec?.instagram_actor_id as string | undefined;
      if (igActor && input.needsInstagram) {
        mergeInstagram(igMap, {
          id: igActor,
          source: "historical_creative",
          confidence: conf,
          pageId: pageId ?? undefined,
          lastUsedAt: lastUsed,
        });
      }
      if (creative.effective_instagram_story_id && input.needsInstagram) {
        mergeInstagram(igMap, {
          id: creative.effective_instagram_story_id,
          source: "historical_creative",
          confidence: conf,
          pageId: pageId ?? undefined,
          lastUsedAt: lastUsed,
        });
      }
      if (creative.effective_instagram_media_id && input.needsInstagram) {
        mergeInstagram(igMap, {
          id: creative.effective_instagram_media_id,
          source: "historical_creative",
          confidence: conf,
          pageId: pageId ?? undefined,
          lastUsedAt: lastUsed,
        });
      }
    }

    if (input.needsWebsite) {
      const urls: string[] = [];
      collectUrlsFromObject(creative.object_story_spec, urls);
      collectUrlsFromObject(creative.asset_feed_spec, urls);
      for (const url of urls) {
        mergeWebsite(websiteMap, {
          url,
          source: "historical_creative",
          confidence: conf,
          lastUsedAt: lastUsed,
        });
      }
    }
  }

  let adSets: RawAdSet[] = [];
  if (input.needsPixel) {
    adSets = await fetchPaged<RawAdSet>(
      `${accountPath}/adsets?fields=id,name,promoted_object,optimization_goal,destination_type,effective_status,updated_time,campaign_id&limit=100`,
      input.token,
      input.connectionId,
    );

    for (const adSet of adSets) {
      const promoted = adSet.promoted_object ?? {};
      const pixelId = promoted.pixel_id as string | undefined;
      if (!pixelId) continue;
      const conf = confidenceForAdStatus(adSet.effective_status, adSet.updated_time);
      const eventType = (promoted.custom_event_type as string | undefined) ?? undefined;
      mergePixel(pixelMap, {
        id: pixelId,
        name: `Pixel ${pixelId}`,
        source: "historical_adset",
        confidence: eventType === "PURCHASE" ? Math.max(conf, 80) as ProfileAssetConfidence : conf,
        eventType,
        lastUsedAt: adSet.updated_time,
      });

      const pageId = promoted.page_id as string | undefined;
      if (pageId && input.needsPage) {
        mergePage(pageMap, {
          id: pageId,
          name: pageId,
          source: "historical_creative",
          confidence: conf,
          lastUsedAt: adSet.updated_time,
          usableForAds: true,
        });
      }
    }

    try {
      const conversions = await fetchPaged<RawCustomConversion>(
        `${accountPath}/customconversions?fields=id,name,custom_event_type,pixel,last_fired_time,is_archived&limit=100`,
        input.token,
        input.connectionId,
      );
      for (const cc of conversions) {
        if (cc.is_archived) continue;
        const pixelRef = cc.pixel;
        const pixelId =
          typeof pixelRef === "string" ? pixelRef : pixelRef?.id;
        if (!pixelId) continue;
        const pixelName =
          typeof pixelRef === "object" ? pixelRef?.name ?? cc.name ?? `Pixel ${pixelId}` : cc.name ?? `Pixel ${pixelId}`;
        mergePixel(pixelMap, {
          id: pixelId,
          name: pixelName,
          source: "custom_conversion",
          confidence: 70,
          eventType: cc.custom_event_type,
          lastFiredTime: cc.last_fired_time,
        });
      }
    } catch {
      // custom conversions optional
    }
  }

  if (input.needsInstagram) {
    try {
      const igAccounts = await fetchPaged<{ id: string; username?: string; name?: string }>(
        `${accountPath}/instagram_accounts?fields=id,username,name&limit=50`,
        input.token,
        input.connectionId,
      );
      for (const ig of igAccounts) {
        mergeInstagram(igMap, {
          id: ig.id,
          username: ig.username,
          name: ig.name,
          source: "direct_instagram_accounts",
          confidence: 100,
        });
      }
    } catch {
      // optional
    }
  }

  return {
    pages: Array.from(pageMap.values()),
    instagramAccounts: Array.from(igMap.values()),
    pixels: Array.from(pixelMap.values()),
    websites: Array.from(websiteMap.values()),
    adsScanned: ads.length,
    adSetsScanned: adSets.length,
    creativesScanned: creatives.length,
  };
}

export async function validatePageCandidate(
  pageId: string,
  token: string,
  connectionId: string,
): Promise<{ valid: boolean; name?: string; pictureUrl?: string; instagramBusinessAccountId?: string }> {
  try {
    const page = await metaRequest<{
      id: string;
      name?: string;
      picture?: { data?: { url?: string } };
      instagram_business_account?: { id?: string };
    }>(`${pageId}?fields=id,name,picture,instagram_business_account{id}`, { token, connectionId });
    return {
      valid: true,
      name: page.name?.trim() || pageId,
      pictureUrl: page.picture?.data?.url,
      instagramBusinessAccountId: page.instagram_business_account?.id,
    };
  } catch {
    return { valid: false };
  }
}

export async function validatePixelCandidate(
  pixelId: string,
  token: string,
  connectionId: string,
): Promise<{ valid: boolean; name?: string; lastFiredTime?: string }> {
  try {
    const pixel = await metaRequest<{ id: string; name?: string; last_fired_time?: string }>(
      `${pixelId}?fields=id,name,last_fired_time`,
      { token, connectionId },
    );
    return {
      valid: true,
      name: pixel.name?.trim() || `Pixel ${pixelId}`,
      lastFiredTime: pixel.last_fired_time,
    };
  } catch {
    return { valid: false };
  }
}

export function sortPageCandidates(pages: ProfilePageCandidate[]): ProfilePageCandidate[] {
  return [...pages].sort((a, b) => {
    const usage = b.usageCount - a.usageCount;
    if (usage !== 0) return usage;
    const conf = b.confidence - a.confidence;
    if (conf !== 0) return conf;
    return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "");
  });
}

export function sortPixelCandidates(pixels: ProfilePixelCandidate[]): ProfilePixelCandidate[] {
  return [...pixels].sort((a, b) => {
    const purchaseA = a.eventType === "PURCHASE" ? 1 : 0;
    const purchaseB = b.eventType === "PURCHASE" ? 1 : 0;
    if (purchaseB !== purchaseA) return purchaseB - purchaseA;
    const usage = b.usageCount - a.usageCount;
    if (usage !== 0) return usage;
    const firedA = a.lastFiredTime ? new Date(a.lastFiredTime).getTime() : 0;
    const firedB = b.lastFiredTime ? new Date(b.lastFiredTime).getTime() : 0;
    if (firedB !== firedA) return firedB - firedA;
    return b.confidence - a.confidence;
  });
}

export function sortWebsiteCandidates(sites: ProfileWebsiteCandidate[]): ProfileWebsiteCandidate[] {
  return [...sites].sort((a, b) => {
    const usage = b.usageCount - a.usageCount;
    if (usage !== 0) return usage;
    return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "");
  });
}

export function resolvePageIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const fbMatch = /facebook\.com\/([^/?#]+)/i.exec(trimmed);
  if (fbMatch?.[1] && /^\d+$/.test(fbMatch[1])) return fbMatch[1];
  return null;
}

export function classifyHistoricalError(error: unknown): string {
  return classifyMetaError(error).message;
}
