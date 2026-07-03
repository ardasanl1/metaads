import type {
  AdAccount,
  AdSetWithInsights,
  AdWithInsights,
  ApiErrorResponse,
  CampaignWithInsights,
  CreateCampaignPayload,
  CreateAdPayload,
  CreateAdSetPayload,
  MetaConnectionStatus,
  MetaConnectionSummary,
  ParsedInsights,
  QuickDateFilter,
} from "@/types/meta";
import type {
  MetaAssetDiagnostics,
  MetaInstagramOption,
  MetaLocationOption,
  MetaPageOption,
  MetaPixelOption,
  ResolvedMetaAssets,
} from "@/types/meta-assets";
import type {
  MetaPagesDiagnostics,
  MetaPixel,
  MetaTargetingLocation,
  GoogleLocationSelection,
  WebsiteSalesSubmit,
  WizardCreateResult,
} from "@/types/campaign-wizard";

type InsightsParams = {
  datePreset?: string;
  since?: string;
  until?: string;
};

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const data = (await response.json()) as T & ApiErrorResponse;
  if (!response.ok) {
    throw new Error(data.error ?? "İstek başarısız oldu");
  }
  return data;
}

export async function fetchMetaStatus(): Promise<MetaConnectionStatus> {
  return apiFetch<MetaConnectionStatus>("/api/meta/status");
}

export async function fetchBusinessDiscovery(params: {
  connectionId: string;
  adAccountId: string;
}): Promise<import("@/types/meta/business-discovery").BusinessDiscoveryResult> {
  return apiFetch(`/api/meta/business-discovery${buildQuery(params)}`);
}

export async function fetchLinkedAdAccounts(connectionId: string): Promise<AdAccount[]> {
  const data = await apiFetch<{ adAccounts: AdAccount[] }>(
    `/api/meta/ad-accounts${buildQuery({ connectionId })}`,
  );
  return data.adAccounts;
}

import type { BusinessDiscoveryMatch } from "@/types/meta/business-discovery";

export type AddLinkedAdAccountResult =
  | {
      ok: true;
      needsBusinessSelection: false;
      connectionId: string;
      business?: {
        businessId: string;
        businessName: string;
        relationship: string;
      };
      adAccounts: Array<{
        id: string;
        accountId: string;
        name: string;
        connectionId: string;
      }>;
      selectedAdAccountId: string;
      selectedAdAccountName: string;
    }
  | {
      ok: true;
      needsBusinessSelection: true;
      normalizedAdAccountId: string;
      matches: BusinessDiscoveryMatch[];
      tokenUser: { id: string; name: string };
      permissions: { granted: string[]; declined: string[] };
      businessesFound: number;
      errors: Array<{ step: string; message: string }>;
    };

export async function addLinkedAdAccount(
  adAccountId: string,
  connectionId: string,
  businessId?: string,
): Promise<AddLinkedAdAccountResult> {
  const response = await fetch("/api/meta/ad-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adAccountId, connectionId, businessId }),
  });
  const data = (await response.json()) as AddLinkedAdAccountResult & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Reklam hesabı eklenemedi");
  }
  return data;
}

export async function activateConnection(connectionId: string): Promise<MetaConnectionSummary> {
  const data = await apiFetch<{ connection: MetaConnectionSummary }>(
    "/api/meta/connections/activate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId }),
    },
  );
  return data.connection;
}

export async function selectAdAccount(
  adAccountId: string,
  connectionId: string,
): Promise<{
  connectionId: string;
  selectedAdAccountId: string;
  selectedAdAccountName: string;
}> {
  return apiFetch("/api/meta/ad-accounts/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adAccountId, connectionId }),
  });
}

export async function disconnectConnection(connectionId: string): Promise<void> {
  await apiFetch("/api/meta/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connectionId }),
  });
}

export async function fetchCampaigns(params?: InsightsParams): Promise<CampaignWithInsights[]> {
  const data = await apiFetch<{ campaigns: CampaignWithInsights[] }>(
    `/api/meta/campaigns${buildQuery(params ?? {})}`,
  );
  return data.campaigns;
}

export async function fetchCampaign(
  id: string,
  params?: InsightsParams,
): Promise<CampaignWithInsights> {
  const data = await apiFetch<{ campaign: CampaignWithInsights }>(
    `/api/meta/campaigns/${id}${buildQuery(params ?? {})}`,
  );
  return data.campaign;
}

export async function createCampaign(payload: CreateCampaignPayload): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/api/meta/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateCampaign(
  id: string,
  input: { name?: string; status?: "ACTIVE" | "PAUSED" },
): Promise<void> {
  await apiFetch(`/api/meta/campaigns/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchAdSets(
  campaignId: string,
  params?: InsightsParams,
): Promise<AdSetWithInsights[]> {
  const data = await apiFetch<{ adsets: AdSetWithInsights[] }>(
    `/api/meta/adsets${buildQuery({ campaignId, ...params })}`,
  );
  return data.adsets;
}

export async function updateAdSet(
  id: string,
  input: { name?: string; status?: "ACTIVE" | "PAUSED"; dailyBudget?: number },
): Promise<void> {
  await apiFetch(`/api/meta/adsets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function createAdSet(payload: CreateAdSetPayload): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/api/meta/adsets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchAds(
  adSetId: string,
  params?: InsightsParams,
): Promise<AdWithInsights[]> {
  const data = await apiFetch<{ ads: AdWithInsights[] }>(
    `/api/meta/ads${buildQuery({ adSetId, ...params })}`,
  );
  return data.ads;
}

export async function updateAd(
  id: string,
  input: { name?: string; status?: "ACTIVE" | "PAUSED" },
): Promise<void> {
  await apiFetch(`/api/meta/ads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function createAd(payload: CreateAdPayload): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/api/meta/ads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadAdImage(file: File): Promise<{ imageHash: string }> {
  const form = new FormData();
  form.append("image", file);
  return apiFetch<{ imageHash: string }>("/api/meta/adimages", {
    method: "POST",
    body: form,
  });
}

export async function fetchPages(params?: {
  connectionId?: string;
  adAccountId?: string;
}): Promise<{ pages: MetaPageOption[]; diagnostics?: MetaPagesDiagnostics }> {
  const data = await apiFetch<{ pages: MetaPageOption[]; diagnostics?: MetaPagesDiagnostics }>(
    `/api/meta/pages${buildQuery({
      connectionId: params?.connectionId,
      adAccountId: params?.adAccountId,
    })}`,
  );
  return { pages: data.pages, diagnostics: data.diagnostics };
}

export async function fetchInstagramAccounts(
  pageId: string,
  params?: { connectionId?: string; pageName?: string },
): Promise<MetaInstagramOption[]> {
  const data = await apiFetch<{ accounts: MetaInstagramOption[] }>(
    `/api/meta/instagram-accounts${buildQuery({
      pageId,
      connectionId: params?.connectionId,
      pageName: params?.pageName,
    })}`,
  );
  return data.accounts;
}

export async function fetchPixels(params?: {
  connectionId?: string;
  adAccountId?: string;
}): Promise<MetaPixel[]> {
  const data = await fetchPixelsDetailed(params);
  return data.pixels
    .filter((pixel) => pixel.available)
    .map((pixel) => ({
      id: pixel.id,
      name: pixel.name,
      lastFiredTime: pixel.lastFiredTime,
      isAvailable: true,
    }));
}

export async function fetchPixelsDetailed(params?: {
  connectionId?: string;
  adAccountId?: string;
}): Promise<{
  pixels: MetaPixelOption[];
  diagnostics: {
    requestSucceeded: boolean;
    availableCount: number;
    totalCount: number;
    reason?: string;
    detail?: string;
  };
}> {
  const data = await apiFetch<{
    pixels: MetaPixelOption[];
    diagnostics: {
      requestSucceeded: boolean;
      availableCount: number;
      totalCount: number;
      reason?: string;
      detail?: string;
    };
  }>(
    `/api/meta/pixels${buildQuery({
      connectionId: params?.connectionId,
      adAccountId: params?.adAccountId,
    })}`,
  );
  return data;
}

export async function fetchMetaTargetingLocations(params: {
  query: string;
  connectionId?: string;
  countryCode?: string;
}): Promise<MetaLocationOption[]> {
  const data = await apiFetch<{ locations: MetaLocationOption[] }>(
    `/api/meta/targeting-locations${buildQuery({
      query: params.query,
      connectionId: params.connectionId,
      countryCode: params.countryCode,
    })}`,
  );
  return data.locations;
}

export async function resolveMetaAssets(params: {
  connectionId: string;
  businessId?: string;
  adAccountId: string;
  recipeId: string;
  locationQuery?: string;
  countryCode?: string;
  pageId?: string;
}): Promise<ResolvedMetaAssets> {
  return apiFetch<ResolvedMetaAssets>(
    `/api/meta/assets/resolve${buildQuery({
      connectionId: params.connectionId,
      businessId: params.businessId,
      adAccountId: params.adAccountId,
      recipeId: params.recipeId,
      locationQuery: params.locationQuery,
      countryCode: params.countryCode,
      pageId: params.pageId,
    })}`,
  );
}

export async function fetchMetaAssetDiagnostics(params: {
  connectionId: string;
  businessId?: string;
  adAccountId: string;
  pageId?: string;
  locationQuery?: string;
  countryCode?: string;
}): Promise<MetaAssetDiagnostics> {
  const data = await apiFetch<{ diagnostics: MetaAssetDiagnostics }>(
    `/api/meta/assets/diagnostics${buildQuery({
      connectionId: params.connectionId,
      businessId: params.businessId,
      adAccountId: params.adAccountId,
      pageId: params.pageId,
      locationQuery: params.locationQuery,
      countryCode: params.countryCode,
    })}`,
  );
  return data.diagnostics;
}

export async function fetchGoogleLocationDetails(params: {
  placeId: string;
  sessionToken: string;
}): Promise<GoogleLocationSelection> {
  const data = await apiFetch<{ selection: GoogleLocationSelection }>(
    `/api/locations/details${buildQuery(params)}`,
  );
  return data.selection;
}

export async function resolveMetaGeoLocation(params: {
  connectionId?: string;
  countryCode: string;
  cityName?: string;
  regionName?: string;
  displayName?: string;
  query?: string;
  adAccountId?: string;
}): Promise<{
  city: MetaTargetingLocation | null;
  region: MetaTargetingLocation | null;
  match: MetaTargetingLocation | null;
  error?: string | null;
}> {
  const data = await apiFetch<{
    city: MetaTargetingLocation | null;
    region: MetaTargetingLocation | null;
    match: MetaTargetingLocation | null;
    error?: string | null;
  }>(
    `/api/meta/targeting-locations${buildQuery({
      resolve: "1",
      connectionId: params.connectionId,
      countryCode: params.countryCode,
      cityName: params.cityName,
      regionName: params.regionName,
      displayName: params.displayName,
      query: params.query,
      adAccountId: params.adAccountId,
    })}`,
  );
  return data;
}

export async function fetchAccountSnapshot(params: {
  connectionId: string;
  businessId?: string;
  adAccountId: string;
  recipeId: string;
  pageId?: string;
  refresh?: boolean;
}): Promise<import("@/types/meta-assets").AccountSnapshot> {
  const data = await apiFetch<{ snapshot: import("@/types/meta-assets").AccountSnapshot }>(
    `/api/meta/account-snapshot${buildQuery({
      connectionId: params.connectionId,
      businessId: params.businessId,
      adAccountId: params.adAccountId,
      recipeId: params.recipeId,
      pageId: params.pageId,
      refresh: params.refresh ? "1" : undefined,
    })}`,
  );
  return data.snapshot;
}

export async function fetchPageBoundAssets(params: {
  connectionId: string;
  recipeId: string;
  pageId: string;
  pageName?: string;
}): Promise<{
  instagramAccounts: MetaInstagramOption[];
  instantForms: import("@/types/meta-assets").MetaInstantFormOption[];
  whatsappAccounts: import("@/types/meta-assets").MetaWhatsAppOption[];
}> {
  return apiFetch(
    `/api/meta/page-bound-assets${buildQuery({
      connectionId: params.connectionId,
      recipeId: params.recipeId,
      pageId: params.pageId,
      pageName: params.pageName,
    })}`,
  );
}

export async function runRecipeWizard(payload: WebsiteSalesSubmit): Promise<WizardCreateResult> {
  const data = await apiFetch<{ result: WizardCreateResult }>("/api/meta/wizard/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.result;
}

export async function runWebsiteSalesWizard(
  payload: WebsiteSalesSubmit,
): Promise<WizardCreateResult> {
  return runRecipeWizard({
    ...payload,
    recipeId: payload.recipeId ?? "SALES_WEBSITE",
  });
}

export async function fetchAccountInsights(params?: InsightsParams): Promise<ParsedInsights> {
  const data = await apiFetch<{ insights: ParsedInsights }>(
    `/api/meta/insights${buildQuery(params ?? {})}`,
  );
  return data.insights;
}

export type { QuickDateFilter, InsightsParams };
