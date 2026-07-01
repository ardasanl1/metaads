import type {
  AdAccount,
  AdSetWithInsights,
  AdWithInsights,
  ApiErrorResponse,
  Business,
  CampaignWithInsights,
  CreateCampaignPayload,
  MetaConnectionStatus,
  MetaConnectionSummary,
  ParsedInsights,
  QuickDateFilter,
} from "@/types/meta";

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

export async function fetchBusinesses(connectionId: string): Promise<Business[]> {
  const data = await apiFetch<{ businesses: Business[] }>(
    `/api/meta/businesses${buildQuery({ connectionId })}`,
  );
  return data.businesses;
}

export async function fetchAdAccounts(
  connectionId: string,
  businessId?: string | null,
): Promise<AdAccount[]> {
  const data = await apiFetch<{ adAccounts: AdAccount[] }>(
    `/api/meta/ad-accounts${buildQuery({
      connectionId,
      businessId: businessId ?? undefined,
    })}`,
  );
  return data.adAccounts;
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
  adAccountName: string,
  connectionId: string,
): Promise<{
  connectionId: string;
  selectedAdAccountId: string;
  selectedAdAccountName: string;
}> {
  return apiFetch("/api/meta/ad-accounts/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adAccountId, adAccountName, connectionId }),
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

export async function fetchAccountInsights(params?: InsightsParams): Promise<ParsedInsights> {
  const data = await apiFetch<{ insights: ParsedInsights }>(
    `/api/meta/insights${buildQuery(params ?? {})}`,
  );
  return data.insights;
}

export type { QuickDateFilter, InsightsParams };
