import type {
  AdAccount,
  ApiErrorResponse,
  Business,
  CampaignWithInsights,
  MetaConnectionStatus,
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

export async function fetchBusinesses(): Promise<Business[]> {
  const data = await apiFetch<{ businesses: Business[] }>("/api/meta/businesses");
  return data.businesses;
}

export async function fetchAdAccounts(businessId?: string | null): Promise<AdAccount[]> {
  const data = await apiFetch<{ adAccounts: AdAccount[] }>(
    `/api/meta/ad-accounts${buildQuery({ businessId: businessId ?? undefined })}`,
  );
  return data.adAccounts;
}

export async function selectAdAccount(adAccountId: string, adAccountName: string): Promise<void> {
  await apiFetch("/api/meta/ad-accounts/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adAccountId, adAccountName }),
  });
}

export async function fetchCampaigns(params?: InsightsParams): Promise<CampaignWithInsights[]> {
  const data = await apiFetch<{ campaigns: CampaignWithInsights[] }>(
    `/api/meta/campaigns${buildQuery(params ?? {})}`,
  );
  return data.campaigns;
}

export async function fetchAccountInsights(params?: InsightsParams): Promise<ParsedInsights> {
  const data = await apiFetch<{ insights: ParsedInsights }>(
    `/api/meta/insights${buildQuery(params ?? {})}`,
  );
  return data.insights;
}

export type { QuickDateFilter, InsightsParams };
