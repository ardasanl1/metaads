export type MetaAssetUsability =
  | "DISCOVERED_AND_USABLE"
  | "DISCOVERED_NOT_ASSIGNED"
  | "PERMISSION_MISSING"
  | "GRANULAR_ACCESS_MISSING"
  | "NOT_FOUND"
  | "API_ERROR"
  | "TOKEN_EXPIRED";

export type MetaAuthMethod = "oauth" | "manual";

export type SyncedBusiness = {
  id: string;
  connectionId: string;
  metaBusinessId: string;
  name: string;
  usability: MetaAssetUsability;
  discoverySource: string;
  lastSyncedAt: string;
};

export type SyncedAdAccount = {
  id: string;
  connectionId: string;
  metaAdAccountId: string;
  accountId: string;
  name: string;
  businessId?: string;
  usability: MetaAssetUsability;
  discoverySource: string;
  lastSyncedAt: string;
};

export type SyncedPage = {
  id: string;
  connectionId: string;
  metaPageId: string;
  name: string;
  businessId?: string;
  usability: MetaAssetUsability;
  discoverySource: string;
  instagramBusinessAccountId?: string;
  lastSyncedAt: string;
};

export type SyncedInstagramAccount = {
  id: string;
  connectionId: string;
  metaInstagramId: string;
  username?: string;
  pageId?: string;
  adAccountId?: string;
  usability: MetaAssetUsability;
  discoverySource: string;
  lastSyncedAt: string;
};

export type SyncedPixel = {
  id: string;
  connectionId: string;
  metaPixelId: string;
  name: string;
  adAccountId?: string;
  businessId?: string;
  usability: MetaAssetUsability;
  discoverySource: string;
  lastFiredTime?: string;
  lastSyncedAt: string;
};

export type MetaAssetSyncReport = {
  connectionId: string;
  syncedAt: string;
  tokenSubject?: { id: string; name?: string };
  grantedPermissions: string[];
  missingPermissions: string[];
  granularIssues: string[];
  counts: {
    businesses: number;
    adAccounts: number;
    pages: number;
    instagramAccounts: number;
    pixels: number;
    usablePages: number;
    usablePixels: number;
  };
  unassignedAssets: Array<{
    type: "page" | "pixel" | "instagram";
    name: string;
    message: string;
  }>;
  errors: string[];
};

export type OnboardingOptions = {
  connectionId: string;
  businesses: Array<{ id: string; name: string }>;
  adAccounts: Array<{ id: string; name: string; businessId?: string }>;
  pages: Array<{ id: string; name: string; usability: MetaAssetUsability }>;
  instagramAccounts: Array<{ id: string; username?: string; pageId?: string }>;
  pixels: Array<{ id: string; name: string; adAccountId?: string; usability: MetaAssetUsability }>;
  websiteSuggestions: string[];
  autoSelections: {
    businessId?: string;
    adAccountId?: string;
    pageId?: string;
    instagramId?: string;
    pixelId?: string;
    websiteUrl?: string;
  };
  needsOnboarding: boolean;
  assetIssues: MetaAssetSyncReport["unassignedAssets"];
};

export type OnboardingSelection = {
  connectionId: string;
  businessId?: string;
  adAccountId: string;
  adAccountName?: string;
  pageId?: string;
  pageName?: string;
  instagramId?: string;
  instagramUsername?: string;
  pixelId?: string;
  pixelName?: string;
  websiteUrl?: string;
};
