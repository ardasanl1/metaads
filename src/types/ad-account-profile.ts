export type AssetSource =
  | "direct"
  | "historical_ad"
  | "historical_adset"
  | "custom_conversion"
  | "manual";

export type PixelSource =
  | "direct_adspixels"
  | "historical_adset"
  | "custom_conversion"
  | "manual";

export type PageSource =
  | "direct_promote_pages"
  | "direct_user_accounts"
  | "direct_business"
  | "historical_creative"
  | "manual"
  | "manual_verified";

export type WebsiteSource = "historical_creative" | "historical_ad" | "manual";

export type ProfileAssetConfidence = 0 | 40 | 50 | 70 | 80 | 90 | 100;

export type ProfilePageCandidate = {
  id: string;
  name: string;
  pictureUrl?: string;
  instagramBusinessAccountId?: string;
  sources: PageSource[];
  confidence: ProfileAssetConfidence;
  usageCount: number;
  lastUsedAt?: string;
  usableForAds: boolean;
};

export type ProfileInstagramCandidate = {
  id: string;
  username?: string;
  name?: string;
  pageId?: string;
  sources: string[];
  confidence: ProfileAssetConfidence;
  usageCount: number;
  lastUsedAt?: string;
};

export type ProfilePixelCandidate = {
  id: string;
  name: string;
  sources: PixelSource[];
  confidence: ProfileAssetConfidence;
  eventType?: string;
  usageCount: number;
  lastUsedAt?: string;
  lastFiredTime?: string;
};

export type ProfileWebsiteCandidate = {
  url: string;
  domain: string;
  sources: WebsiteSource[];
  confidence: ProfileAssetConfidence;
  usageCount: number;
  lastUsedAt?: string;
};

export type AdAccountProfileRecord = {
  id: string;
  connectionId: string;
  adAccountId: string;
  businessId?: string;
  defaultPageId?: string;
  defaultPageName?: string;
  defaultInstagramId?: string;
  defaultInstagramUsername?: string;
  defaultPixelId?: string;
  defaultPixelName?: string;
  defaultPixelEventType?: string;
  defaultWebsiteUrl?: string;
  defaultDomain?: string;
  pageSource?: PageSource;
  pixelSource?: PixelSource;
  websiteSource?: WebsiteSource;
  instagramSource?: string;
  pageConfidence?: ProfileAssetConfidence;
  pixelConfidence?: ProfileAssetConfidence;
  websiteConfidence?: ProfileAssetConfidence;
  instagramConfidence?: ProfileAssetConfidence;
  lastDiscoveredAt?: string;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProfileResolvedAsset = {
  id?: string;
  name?: string;
  username?: string;
  url?: string;
  domain?: string;
  eventType?: string;
  source: string;
  confidence: ProfileAssetConfidence;
};

export type AccountProfileDiscoveryResult = {
  success: boolean;
  profile: {
    page: ProfileResolvedAsset | null;
    instagram: ProfileResolvedAsset | null;
    pixel: ProfileResolvedAsset | null;
    website: ProfileResolvedAsset | null;
  };
  candidates: {
    pages: ProfilePageCandidate[];
    instagramAccounts: ProfileInstagramCandidate[];
    pixels: ProfilePixelCandidate[];
    websites: ProfileWebsiteCandidate[];
  };
  diagnostics: {
    directPageCount: number;
    historicalPageCount: number;
    directPixelCount: number;
    historicalPixelCount: number;
    customConversionPixelCount: number;
    websiteCount: number;
    adsScanned: number;
    adSetsScanned: number;
    creativesScanned: number;
    fromCache: boolean;
    needsManualSetup: string[];
  };
};

export type ManualProfileInput = {
  connectionId: string;
  adAccountId: string;
  businessId?: string;
  pageIdOrUrl?: string;
  pixelId?: string;
  websiteUrl?: string;
  instagramId?: string;
};
