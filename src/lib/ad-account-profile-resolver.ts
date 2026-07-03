import "server-only";

import {
  getAdAccountProfile,
  profileNeedsFullDiscovery,
  upsertAdAccountProfile,
} from "@/lib/ad-account-profile-db";
import { profileIsCompleteForRecipe } from "@/utils/profile-completeness";
import { requireMetaConnectionContext } from "@/lib/meta-connection-context";
import {
  discoverFromAdHistory,
  sortPageCandidates,
  sortPixelCandidates,
  sortWebsiteCandidates,
  validatePageCandidate,
  validatePixelCandidate,
} from "@/lib/meta-historical-discovery";
import { resolveFacebookPages, verifyFacebookPageById } from "@/lib/meta-page-resolver";
import { resolveInstagramAccounts } from "@/lib/meta-instagram-resolver";
import { resolveAdAccountPixels } from "@/lib/meta-pixel-resolver";
import type {
  AccountProfileDiscoveryResult,
  AdAccountProfileRecord,
  ManualProfileInput,
  PageSource,
  PixelSource,
  ProfileAssetConfidence,
  ProfileInstagramCandidate,
  ProfilePageCandidate,
  ProfilePixelCandidate,
  ProfileWebsiteCandidate,
} from "@/types/ad-account-profile";
import { extractDomain, normalizeWebsiteUrl } from "@/utils/url-normalize";
import type { MetaPageSource } from "@/types/meta-assets";

const AUTO_SELECT_MIN_CONFIDENCE: ProfileAssetConfidence = 70;

function mapDirectPageSource(source: MetaPageSource | string): PageSource {
  if (source === "ad_account" || source === "ad_account_promote_pages") return "direct_promote_pages";
  if (source === "business_owned" || source === "business_client") return "direct_business";
  return "direct_user_accounts";
}

function mergePageCandidate(map: Map<string, ProfilePageCandidate>, page: ProfilePageCandidate): void {
  const existing = map.get(page.id);
  if (!existing) {
    map.set(page.id, page);
    return;
  }
  for (const s of page.sources) {
    if (!existing.sources.includes(s)) existing.sources.push(s);
  }
  existing.confidence = Math.max(existing.confidence, page.confidence) as ProfileAssetConfidence;
  existing.usageCount += page.usageCount;
  existing.usableForAds = existing.usableForAds || page.usableForAds;
  if (page.name && page.name !== page.id) existing.name = page.name;
  existing.pictureUrl = existing.pictureUrl ?? page.pictureUrl;
  existing.instagramBusinessAccountId =
    existing.instagramBusinessAccountId ?? page.instagramBusinessAccountId;
  if (page.lastUsedAt && (!existing.lastUsedAt || page.lastUsedAt > existing.lastUsedAt)) {
    existing.lastUsedAt = page.lastUsedAt;
  }
}

function pickSingleCandidate<T extends { confidence: ProfileAssetConfidence }>(
  items: T[],
): T | null {
  if (items.length === 0) return null;
  if (items.length === 1 && items[0].confidence >= AUTO_SELECT_MIN_CONFIDENCE) return items[0];
  const strong = items.filter((i) => i.confidence >= AUTO_SELECT_MIN_CONFIDENCE);
  if (strong.length === 1) return strong[0];
  return null;
}

function profileToDiscoveryResult(
  profile: AdAccountProfileRecord,
  candidates: AccountProfileDiscoveryResult["candidates"],
  diagnostics: AccountProfileDiscoveryResult["diagnostics"],
): AccountProfileDiscoveryResult {
  return {
    success: true,
    profile: {
      page: profile.defaultPageId
        ? {
            id: profile.defaultPageId,
            name: profile.defaultPageName ?? profile.defaultPageId,
            source: profile.pageSource ?? "manual",
            confidence: profile.pageConfidence ?? 40,
          }
        : null,
      instagram: profile.defaultInstagramId
        ? {
            id: profile.defaultInstagramId,
            username: profile.defaultInstagramUsername,
            source: profile.instagramSource ?? "manual",
            confidence: profile.instagramConfidence ?? 40,
          }
        : null,
      pixel: profile.defaultPixelId
        ? {
            id: profile.defaultPixelId,
            name: profile.defaultPixelName ?? profile.defaultPixelId,
            eventType: profile.defaultPixelEventType,
            source: profile.pixelSource ?? "manual",
            confidence: profile.pixelConfidence ?? 40,
          }
        : null,
      website: profile.defaultWebsiteUrl
        ? {
            url: profile.defaultWebsiteUrl,
            domain: profile.defaultDomain ?? extractDomain(profile.defaultWebsiteUrl) ?? "",
            source: profile.websiteSource ?? "manual",
            confidence: profile.websiteConfidence ?? 40,
          }
        : null,
    },
    candidates,
    diagnostics,
  };
}

export async function discoverAdAccountProfile(input: {
  connectionId: string;
  businessId?: string;
  adAccountId: string;
  forceRefresh?: boolean;
  needsPage?: boolean;
  needsPixel?: boolean;
  needsWebsite?: boolean;
  needsInstagram?: boolean;
}): Promise<AccountProfileDiscoveryResult> {
  const needsPage = input.needsPage ?? true;
  const needsPixel = input.needsPixel ?? true;
  const needsWebsite = input.needsWebsite ?? true;
  const needsInstagram = input.needsInstagram ?? true;

  const ctx = await requireMetaConnectionContext(input);
  const existing = await getAdAccountProfile(ctx.connectionId, input.adAccountId);

  const emptyCandidates = {
    pages: [] as ProfilePageCandidate[],
    instagramAccounts: [] as ProfileInstagramCandidate[],
    pixels: [] as ProfilePixelCandidate[],
    websites: [] as ProfileWebsiteCandidate[],
  };

  if (
    existing &&
    !profileNeedsFullDiscovery(existing, input.forceRefresh) &&
    profileIsCompleteForRecipe(existing, { page: needsPage, pixel: needsPixel, website: needsWebsite })
  ) {
    return profileToDiscoveryResult(existing, emptyCandidates, {
      directPageCount: 0,
      historicalPageCount: 0,
      directPixelCount: 0,
      historicalPixelCount: 0,
      customConversionPixelCount: 0,
      websiteCount: 0,
      adsScanned: 0,
      adSetsScanned: 0,
      creativesScanned: 0,
      fromCache: true,
      needsManualSetup: [],
    });
  }

  const pageMap = new Map<string, ProfilePageCandidate>();
  const pixelMap = new Map<string, ProfilePixelCandidate>();
  const websiteMap = new Map<string, ProfileWebsiteCandidate>();
  const igMap = new Map<string, ProfileInstagramCandidate>();

  let directPageCount = 0;
  let directPixelCount = 0;

  if (needsPage) {
    const directPages = await resolveFacebookPages({
      connectionId: ctx.connectionId,
      businessId: input.businessId ?? ctx.metaBusinessId,
      adAccountId: input.adAccountId,
      profilePageId: existing?.defaultPageId,
    });
    directPageCount = directPages.pages.length;
    for (const page of directPages.pages) {
      const source = mapDirectPageSource(page.sources?.[0] ?? page.source ?? "user_accounts");
      mergePageCandidate(pageMap, {
        id: page.id,
        name: page.name,
        pictureUrl: page.pictureUrl,
        instagramBusinessAccountId: page.instagramBusinessAccountId,
        sources: [source],
        confidence: 100,
        usageCount: 1,
        usableForAds: page.usableForAds,
      });
      if (page.instagramBusinessAccountId && needsInstagram) {
        igMap.set(page.instagramBusinessAccountId, {
          id: page.instagramBusinessAccountId,
          pageId: page.id,
          sources: ["page_instagram_business_account"],
          confidence: 100,
          usageCount: 1,
        });
      }
    }
  }

  if (needsPixel) {
    const directPixels = await resolveAdAccountPixels({
      connectionId: ctx.connectionId,
      adAccountId: input.adAccountId,
    });
    directPixelCount = directPixels.pixels.length;
    for (const pixel of directPixels.pixels) {
      const source: PixelSource = pixel.available ? "direct_adspixels" : "custom_conversion";
      pixelMap.set(pixel.id, {
        id: pixel.id,
        name: pixel.name,
        sources: [source],
        confidence: pixel.available ? 100 : 50,
        usageCount: 1,
        lastFiredTime: pixel.lastFiredTime,
      });
    }
  }

  if (needsInstagram) {
    const instagramResult = await resolveInstagramAccounts({
      connectionId: ctx.connectionId,
      adAccountId: input.adAccountId,
      pages: Array.from(pageMap.values()).map((p) => ({
        id: p.id,
        name: p.name,
        instagramBusinessAccountId: p.instagramBusinessAccountId,
      })),
    });
    for (const ig of instagramResult.accounts) {
      igMap.set(ig.id, {
        id: ig.id,
        username: ig.username,
        name: ig.name ?? ig.username,
        pageId: ig.pageId,
        sources: ["ad_account_instagram"],
        confidence: 100,
        usageCount: 1,
      });
    }
  }

  const needsHistorical =
    (needsPage && pageMap.size === 0) ||
    (needsPixel && pixelMap.size === 0) ||
    needsWebsite ||
    needsInstagram;

  let historical = {
    pages: [] as ProfilePageCandidate[],
    instagramAccounts: [] as ProfileInstagramCandidate[],
    pixels: [] as ProfilePixelCandidate[],
    websites: [] as ProfileWebsiteCandidate[],
    adsScanned: 0,
    adSetsScanned: 0,
    creativesScanned: 0,
  };

  if (needsHistorical) {
    historical = await discoverFromAdHistory({
      connectionId: ctx.connectionId,
      adAccountId: input.adAccountId,
      token: ctx.accessToken,
      needsPage,
      needsPixel,
      needsWebsite,
      needsInstagram,
    });
    for (const page of historical.pages) mergePageCandidate(pageMap, page);
    for (const pixel of historical.pixels) {
      const existingPixel = pixelMap.get(pixel.id);
      if (existingPixel) {
        for (const s of pixel.sources) {
          if (!existingPixel.sources.includes(s)) existingPixel.sources.push(s);
        }
        existingPixel.confidence = Math.max(existingPixel.confidence, pixel.confidence) as ProfileAssetConfidence;
        existingPixel.usageCount += pixel.usageCount;
        existingPixel.eventType = existingPixel.eventType ?? pixel.eventType;
      } else {
        pixelMap.set(pixel.id, pixel);
      }
    }
    for (const site of historical.websites) websiteMap.set(site.url, site);
    for (const ig of historical.instagramAccounts) {
      const ex = igMap.get(ig.id);
      if (ex) {
        for (const s of ig.sources) if (!ex.sources.includes(s)) ex.sources.push(s);
        ex.confidence = Math.max(ex.confidence, ig.confidence) as ProfileAssetConfidence;
        ex.usageCount += ig.usageCount;
      } else {
        igMap.set(ig.id, ig);
      }
    }
  }

  const validatedPages: ProfilePageCandidate[] = [];
  for (const candidate of sortPageCandidates(Array.from(pageMap.values()))) {
    const isTrustedDirect =
      candidate.confidence >= 100 &&
      (candidate.sources.includes("direct_user_accounts") ||
        candidate.sources.includes("manual_verified"));

    if (isTrustedDirect) {
      validatedPages.push(candidate);
      if (candidate.instagramBusinessAccountId && needsInstagram) {
        igMap.set(candidate.instagramBusinessAccountId, {
          id: candidate.instagramBusinessAccountId,
          pageId: candidate.id,
          sources: ["page_instagram_business_account"],
          confidence: candidate.confidence,
          usageCount: candidate.usageCount,
          lastUsedAt: candidate.lastUsedAt,
        });
      }
      continue;
    }

    const validation = await validatePageCandidate(candidate.id, ctx.accessToken, ctx.connectionId);
    if (!validation.valid) continue;
    validatedPages.push({
      ...candidate,
      name: validation.name ?? candidate.name,
      pictureUrl: validation.pictureUrl ?? candidate.pictureUrl,
      instagramBusinessAccountId:
        validation.instagramBusinessAccountId ?? candidate.instagramBusinessAccountId,
    });
    if (validation.instagramBusinessAccountId && needsInstagram) {
      igMap.set(validation.instagramBusinessAccountId, {
        id: validation.instagramBusinessAccountId,
        pageId: candidate.id,
        sources: ["page_instagram_business_account"],
        confidence: Math.max(candidate.confidence, 90) as ProfileAssetConfidence,
        usageCount: candidate.usageCount,
        lastUsedAt: candidate.lastUsedAt,
      });
    }
  }

  const validatedPixels: ProfilePixelCandidate[] = [];
  for (const candidate of sortPixelCandidates(Array.from(pixelMap.values()))) {
    const validation = await validatePixelCandidate(candidate.id, ctx.accessToken, ctx.connectionId);
    if (!validation.valid) continue;
    validatedPixels.push({
      ...candidate,
      name: validation.name ?? candidate.name,
      lastFiredTime: validation.lastFiredTime ?? candidate.lastFiredTime,
    });
  }

  const validatedWebsites = sortWebsiteCandidates(Array.from(websiteMap.values()));

  const selectedPage = pickSingleCandidate(validatedPages);
  const selectedPixel = pickSingleCandidate(
    validatedPixels.filter((p) => p.sources.includes("direct_adspixels") || p.confidence >= AUTO_SELECT_MIN_CONFIDENCE),
  );
  const selectedWebsite = pickSingleCandidate(validatedWebsites);
  const selectedIg = pickSingleCandidate(
    Array.from(igMap.values()).sort((a, b) => b.confidence - a.confidence || b.usageCount - a.usageCount),
  );

  const now = new Date().toISOString();
  const saved = await upsertAdAccountProfile({
    connectionId: ctx.connectionId,
    adAccountId: input.adAccountId,
    businessId: input.businessId ?? ctx.metaBusinessId,
    defaultPageId: selectedPage?.id,
    defaultPageName: selectedPage?.name,
    defaultInstagramId: selectedIg?.id,
    defaultInstagramUsername: selectedIg?.username,
    defaultPixelId: selectedPixel?.id,
    defaultPixelName: selectedPixel?.name,
    defaultPixelEventType: selectedPixel?.eventType,
    defaultWebsiteUrl: selectedWebsite?.url,
    defaultDomain: selectedWebsite?.domain,
    pageSource: selectedPage?.sources[0],
    pixelSource: selectedPixel?.sources[0] as PixelSource | undefined,
    websiteSource: selectedWebsite?.sources[0],
    instagramSource: selectedIg?.sources[0],
    pageConfidence: selectedPage?.confidence,
    pixelConfidence: selectedPixel?.confidence,
    websiteConfidence: selectedWebsite?.confidence,
    instagramConfidence: selectedIg?.confidence,
    lastDiscoveredAt: now,
    lastVerifiedAt: now,
  });

  const needsManualSetup: string[] = [];
  if (needsPage && !saved.defaultPageId && validatedPages.length === 0) needsManualSetup.push("page");
  if (needsPage && !saved.defaultPageId && validatedPages.length > 1) needsManualSetup.push("page_choice");
  if (needsPixel && !saved.defaultPixelId && validatedPixels.length === 0) needsManualSetup.push("pixel");
  if (needsPixel && !saved.defaultPixelId && validatedPixels.length > 1) needsManualSetup.push("pixel_choice");
  if (needsWebsite && !saved.defaultWebsiteUrl && validatedWebsites.length === 0) needsManualSetup.push("website");
  if (needsWebsite && !saved.defaultWebsiteUrl && validatedWebsites.length > 1) needsManualSetup.push("website_choice");

  const historicalPixelCount = historical.pixels.filter((p) =>
    p.sources.includes("historical_adset"),
  ).length;
  const customConversionPixelCount = historical.pixels.filter((p) =>
    p.sources.includes("custom_conversion"),
  ).length;

  return profileToDiscoveryResult(
    saved,
    {
      pages: validatedPages,
      instagramAccounts: Array.from(igMap.values()),
      pixels: validatedPixels,
      websites: validatedWebsites,
    },
    {
      directPageCount,
      historicalPageCount: historical.pages.length,
      directPixelCount,
      historicalPixelCount,
      customConversionPixelCount,
      websiteCount: validatedWebsites.length,
      adsScanned: historical.adsScanned,
      adSetsScanned: historical.adSetsScanned,
      creativesScanned: historical.creativesScanned,
      fromCache: false,
      needsManualSetup,
    },
  );
}

export async function saveManualAdAccountProfile(
  input: ManualProfileInput,
): Promise<AccountProfileDiscoveryResult> {
  const ctx = await requireMetaConnectionContext(input);
  const updates: Partial<AdAccountProfileRecord> & { connectionId: string; adAccountId: string } = {
    connectionId: ctx.connectionId,
    adAccountId: input.adAccountId,
    businessId: input.businessId ?? ctx.metaBusinessId,
  };

  if (input.pageIdOrUrl?.trim()) {
    const pageId = input.pageIdOrUrl.trim().replace(/\D/g, "");
    if (!pageId) throw new Error("Gecersiz Facebook Page ID");
    const validation = await verifyFacebookPageById({
      connectionId: ctx.connectionId,
      pageId,
    });
    if (!validation.valid) {
      throw new Error(validation.error?.message ?? "Facebook Page dogrulanamadi");
    }
    updates.defaultPageId = validation.pageId ?? pageId;
    updates.defaultPageName = validation.pageName;
    updates.defaultInstagramId = validation.instagramBusinessAccountId;
    updates.pageSource = "manual_verified";
    updates.pageConfidence = 100;
  }

  if (input.pixelId?.trim()) {
    const pixelId = input.pixelId.trim().replace(/\D/g, "");
    if (!pixelId) throw new Error("Geçersiz Pixel ID");
    const validation = await validatePixelCandidate(pixelId, ctx.accessToken, ctx.connectionId);
    if (!validation.valid) throw new Error("Pixel/Dataset doğrulanamadı");
    updates.defaultPixelId = pixelId;
    updates.defaultPixelName = validation.name;
    updates.pixelSource = "manual";
    updates.pixelConfidence = 40;
  }

  if (input.websiteUrl?.trim()) {
    const url = normalizeWebsiteUrl(input.websiteUrl);
    const domain = url ? extractDomain(url) : null;
    if (!url || !domain) throw new Error("Geçersiz website URL");
    updates.defaultWebsiteUrl = url;
    updates.defaultDomain = domain;
    updates.websiteSource = "manual";
    updates.websiteConfidence = 40;
  }

  if (input.instagramId?.trim()) {
    updates.defaultInstagramId = input.instagramId.trim();
    updates.instagramSource = "manual";
    updates.instagramConfidence = 40;
  }

  const now = new Date().toISOString();
  const saved = await upsertAdAccountProfile({
    ...updates,
    lastDiscoveredAt: now,
    lastVerifiedAt: now,
  });

  return profileToDiscoveryResult(saved, {
    pages: [],
    instagramAccounts: [],
    pixels: [],
    websites: [],
  }, {
    directPageCount: 0,
    historicalPageCount: 0,
    directPixelCount: 0,
    historicalPixelCount: 0,
    customConversionPixelCount: 0,
    websiteCount: 0,
    adsScanned: 0,
    adSetsScanned: 0,
    creativesScanned: 0,
    fromCache: false,
    needsManualSetup: [],
  });
}

export { profileSourceLabel as sourceLabel } from "@/utils/profile-source-label";
