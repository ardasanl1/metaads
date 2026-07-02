import "server-only";
import { getMetaConnection, getMetaConnectionById } from "./db";
import { extractMetaErrorMessage } from "./meta-errors";
import {
  normalizeAdAccountId,
  normalizeAdAccountList,
  normalizeAdAccountRecord,
  type AdAccountRaw,
} from "@/utils/ad-account";
import type { BuyingType, CampaignObjective, CampaignStatus, SpecialAdCategoryApi } from "@/utils/campaign-constants";

export { normalizeAdAccountId };

export class MetaApiError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
  }
}

export function getApiVersion(): string {
  return process.env.META_API_VERSION?.trim() || "v23.0";
}

function graphBaseUrl(): string {
  return `https://graph.facebook.com/${getApiVersion()}`;
}

async function parseMetaResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & {
    error?: { message?: string; type?: string; code?: number };
  };

  if (!response.ok || data.error) {
    const message = extractMetaErrorMessage(data, "Meta API isteği başarısız oldu");
    throw new MetaApiError(message, response.ok ? 502 : response.status);
  }

  return data;
}

async function getStoredAccessToken(connectionId?: string): Promise<string> {
  const connection = connectionId
    ? await getMetaConnectionById(connectionId)
    : await getMetaConnection();
  if (!connection) {
    throw new MetaApiError("Meta hesabi bagli degil", 400);
  }
  return connection.accessToken;
}

export async function metaRequest<T = unknown>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    token?: string;
    connectionId?: string;
  } = {},
): Promise<T> {
  const token = options.token ?? (await getStoredAccessToken(options.connectionId));
  const url = path.startsWith("http") ? path : `${graphBaseUrl()}/${path.replace(/^\//, "")}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const init: RequestInit = { method: options.method ?? "GET", headers };

  if (options.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.body)) {
      params.set(key, String(value));
    }
    init.body = params.toString();
  }

  const response = await fetch(url, init);
  return parseMetaResponse<T>(response);
}

export async function metaRequestMultipart<T = unknown>(
  path: string,
  formData: FormData,
  options: { token?: string; connectionId?: string; method?: "POST" } = {},
): Promise<T> {
  const token = options.token ?? (await getStoredAccessToken(options.connectionId));
  const url = path.startsWith("http") ? path : `${graphBaseUrl()}/${path.replace(/^\//, "")}`;
  const response = await fetch(url, {
    method: options.method ?? "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  return parseMetaResponse<T>(response);
}

export async function verifyMetaConnection(
  accessToken: string,
  adAccountId: string,
): Promise<{ accountName: string; adAccountId: string; metaUserId: string | null }> {
  const accountPath = normalizeAdAccountId(adAccountId);
  if (!accountPath) {
    throw new MetaApiError("Reklam hesabi ID gerekli", 400);
  }

  const account = await metaRequest<AdAccountRaw>(`${accountPath}?fields=id,account_id,name`, {
    token: accessToken,
  });
  const normalized = normalizeAdAccountRecord(account);

  let metaUserId: string | null = null;
  try {
    const me = await metaRequest<{ id: string }>("me?fields=id", { token: accessToken });
    metaUserId = me.id;
  } catch {
    metaUserId = null;
  }

  return {
    accountName: normalized.name,
    adAccountId: normalized.id,
    metaUserId,
  };
}

export async function verifyMetaToken(
  accessToken: string,
): Promise<{ metaUserId: string | null; metaUserName: string | null }> {
  return resolveTokenIdentity(accessToken);
}

/** Token sahibini ve bağlı işletme adını çözer. */
export async function resolveTokenIdentity(
  accessToken: string,
): Promise<{ metaUserId: string | null; metaUserName: string | null }> {
  let metaUserId: string | null = null;
  let metaUserName: string | null = null;

  try {
    const me = await metaRequest<{ id: string; name?: string }>("me?fields=id,name", {
      token: accessToken,
    });
    metaUserId = me.id;
    metaUserName = me.name?.trim() || null;
  } catch {
    return { metaUserId: null, metaUserName: null };
  }

  try {
    const businesses = await getBusinesses({ token: accessToken });
    if (businesses.length > 0) {
      metaUserName = businesses[0].name.trim();
    }
  } catch {
    // me.name veya mevcut değer korunur
  }

  return { metaUserId, metaUserName };
}

export type Campaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  created_time: string;
  updated_time: string;
  daily_budget?: string;
  lifetime_budget?: string;
  insights?: { data?: MetaInsightRaw[] };
};

export type Business = {
  id: string;
  name: string;
};

export type AdAccount = {
  id: string;
  accountId: string;
  name: string;
  account_status?: number;
  currency?: string;
};

export type MetaAction = {
  action_type: string;
  value: string;
};

export type MetaInsightRaw = {
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  frequency?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  purchase_roas?: MetaAction[];
  date_start?: string;
  date_stop?: string;
};

export type InsightsQuery = {
  datePreset?: string;
  since?: string;
  until?: string;
};

const INSIGHT_FIELDS =
  "spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions,action_values,purchase_roas";

function buildInsightsParam(query?: InsightsQuery): string {
  if (!query) return "";

  if (query.datePreset) {
    return `insights.date_preset(${query.datePreset}){${INSIGHT_FIELDS}}`;
  }

  if (query.since && query.until) {
    const timeRange = JSON.stringify({ since: query.since, until: query.until });
    return `insights.time_range(${timeRange}){${INSIGHT_FIELDS}}`;
  }

  return `insights.date_preset(last_7d){${INSIGHT_FIELDS}}`;
}

export async function getBusinesses(options?: { token?: string }): Promise<Business[]> {
  try {
    return await fetchPaged<Business>("me/businesses?fields=id,name&limit=100", 100, options?.token);
  } catch {
    return [];
  }
}

export async function getAdAccountsForBusiness(
  businessId: string,
  options?: { token?: string },
): Promise<AdAccount[]> {
  const owned = await fetchPaged<AdAccountRaw>(
    `${businessId}/owned_ad_accounts?fields=id,account_id,name,account_status,currency&limit=100`,
    100,
    options?.token,
  );
  const client = await fetchPaged<AdAccountRaw>(
    `${businessId}/client_ad_accounts?fields=id,account_id,name,account_status,currency&limit=100`,
    100,
    options?.token,
  );

  return normalizeAdAccountList([...owned, ...client]);
}

export async function getUserAdAccounts(options?: { token?: string }): Promise<AdAccount[]> {
  const accounts = await fetchPaged<AdAccountRaw>(
    "me/adaccounts?fields=id,account_id,name,account_status,currency&limit=100",
    100,
    options?.token,
  );
  return normalizeAdAccountList(accounts);
}

export async function getAccountInsights(
  adAccountId: string,
  query?: InsightsQuery,
): Promise<MetaInsightRaw | null> {
  const accountPath = normalizeAdAccountId(adAccountId);
  let path = `${accountPath}/insights?fields=${INSIGHT_FIELDS}`;

  if (query?.datePreset) {
    path += `&date_preset=${query.datePreset}`;
  } else if (query?.since && query?.until) {
    path += `&time_range=${encodeURIComponent(JSON.stringify({ since: query.since, until: query.until }))}`;
  } else {
    path += "&date_preset=last_7d";
  }

  const result = await metaRequest<{ data?: MetaInsightRaw[] }>(path);
  return result.data?.[0] ?? null;
}

export async function getCampaigns(
  adAccountId: string,
  query?: InsightsQuery,
): Promise<Campaign[]> {
  const accountPath = normalizeAdAccountId(adAccountId);
  const baseFields =
    "id,name,objective,status,effective_status,created_time,updated_time,daily_budget,lifetime_budget";
  const insightsParam = buildInsightsParam(query);
  const fields = insightsParam ? `${baseFields},${insightsParam}` : baseFields;
  return fetchPaged<Campaign>(`${accountPath}/campaigns?fields=${fields}&limit=100`);
}

export async function getCampaign(
  campaignId: string,
  query?: InsightsQuery,
): Promise<Campaign | null> {
  const baseFields =
    "id,name,objective,status,effective_status,created_time,updated_time,daily_budget,lifetime_budget";
  const insightsParam = buildInsightsParam(query);
  const fields = insightsParam ? `${baseFields},${insightsParam}` : baseFields;

  try {
    return await metaRequest<Campaign>(`${campaignId}?fields=${fields}`);
  } catch (error) {
    if (error instanceof MetaApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export type CreateCampaignInput = {
  name: string;
  objective: CampaignObjective;
  buyingType: BuyingType;
  specialAdCategories: SpecialAdCategoryApi[];
  status?: CampaignStatus;
  isAdsetBudgetSharingEnabled?: boolean;
};

export async function createCampaign(
  adAccountId: string,
  input: CreateCampaignInput,
): Promise<{ id: string }> {
  const accountPath = normalizeAdAccountId(adAccountId);
  if (!accountPath) {
    throw new MetaApiError("Reklam hesabı ID gerekli", 400);
  }

  const categories = input.specialAdCategories;

  const body: Record<string, string> = {
    name: input.name.trim(),
    objective: input.objective,
    buying_type: input.buyingType,
    status: input.status ?? "PAUSED",
    special_ad_categories: JSON.stringify(categories),
    is_adset_budget_sharing_enabled: input.isAdsetBudgetSharingEnabled ? "true" : "false",
  };

  return metaRequest<{ id: string }>(`${accountPath}/campaigns`, {
    method: "POST",
    body,
  });
}

export type AdSet = {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  end_time?: string;
  targeting?: unknown;
  insights?: { data?: MetaInsightRaw[] };
};

export async function getAdSets(campaignId: string, query?: InsightsQuery): Promise<AdSet[]> {
  const baseFields =
    "id,campaign_id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,targeting";
  const insightsParam = buildInsightsParam(query);
  const fields = insightsParam ? `${baseFields},${insightsParam}` : baseFields;
  return fetchPaged<AdSet>(`${campaignId}/adsets?fields=${fields}&limit=100`);
}

export type CreateAdSetInput = {
  name: string;
  campaignId: string;
  dailyBudget: number;
  status?: "ACTIVE" | "PAUSED";
  billingEvent: string;
  optimizationGoal: string;
  targeting: unknown;
  promotedObject?: unknown;
  startTime?: string;
  endTime?: string;
};

export async function createAdSet(
  adAccountId: string,
  input: CreateAdSetInput,
): Promise<{ id: string }> {
  const accountPath = normalizeAdAccountId(adAccountId);
  if (!accountPath) {
    throw new MetaApiError("Reklam hesabı ID gerekli", 400);
  }

  const body: Record<string, string | number> = {
    name: input.name.trim(),
    campaign_id: input.campaignId,
    daily_budget: Math.round(input.dailyBudget * 100),
    status: input.status ?? "PAUSED",
    billing_event: input.billingEvent,
    optimization_goal: input.optimizationGoal,
    targeting: JSON.stringify(input.targeting ?? {}),
  };

  if (input.promotedObject) {
    body.promoted_object = JSON.stringify(input.promotedObject);
  }
  if (input.startTime) {
    body.start_time = input.startTime;
  }
  if (input.endTime) {
    body.end_time = input.endTime;
  }

  return metaRequest<{ id: string }>(`${accountPath}/adsets`, { method: "POST", body });
}

export type AdCreative = {
  id: string;
  name?: string;
  thumbnail_url?: string;
};

export type Ad = {
  id: string;
  name: string;
  campaign_id: string;
  adset_id: string;
  status: string;
  effective_status: string;
  created_time: string;
  updated_time: string;
  creative?: AdCreative;
  issues_info?: unknown;
  ad_review_feedback?: unknown;
  insights?: { data?: MetaInsightRaw[] };
};

export async function getAds(adSetId: string, query?: InsightsQuery): Promise<Ad[]> {
  const baseFields =
    "id,name,campaign_id,adset_id,status,effective_status,created_time,updated_time,creative{id,name,thumbnail_url},issues_info,ad_review_feedback";
  const insightsParam = buildInsightsParam(query);
  const fields = insightsParam ? `${baseFields},${insightsParam}` : baseFields;
  return fetchPaged<Ad>(`${adSetId}/ads?fields=${fields}&limit=100`);
}

export type CreateAdInput = {
  name: string;
  adSetId: string;
  creativeId: string;
  status?: "ACTIVE" | "PAUSED";
};

export async function createAd(
  adAccountId: string,
  input: CreateAdInput,
): Promise<{ id: string }> {
  const accountPath = normalizeAdAccountId(adAccountId);
  if (!accountPath) {
    throw new MetaApiError("Reklam hesabı ID gerekli", 400);
  }

  const body: Record<string, string> = {
    name: input.name.trim(),
    adset_id: input.adSetId,
    status: input.status ?? "PAUSED",
    creative: JSON.stringify({ creative_id: input.creativeId }),
  };

  return metaRequest<{ id: string }>(`${accountPath}/ads`, { method: "POST", body });
}

export type UploadedAdImage = { hash: string };

export async function uploadAdImage(
  adAccountId: string,
  file: File,
): Promise<UploadedAdImage> {
  const accountPath = normalizeAdAccountId(adAccountId);
  if (!accountPath) {
    throw new MetaApiError("Reklam hesabı ID gerekli", 400);
  }

  const form = new FormData();
  form.append("filename", file);

  const result = await metaRequestMultipart<{ images?: Record<string, { hash: string }> }>(
    `${accountPath}/adimages`,
    form,
  );

  const first = result.images ? Object.values(result.images)[0] : null;
  if (!first?.hash) {
    throw new MetaApiError("Görsel yüklenemedi (hash alınamadı)", 502);
  }
  return { hash: first.hash };
}

export type CreateAdCreativeInput = {
  name: string;
  pageId: string;
  instagramActorId?: string;
  websiteUrl: string;
  imageHash: string;
  primaryText: string;
  headline: string;
  description?: string;
  ctaType: "SHOP_NOW" | "LEARN_MORE" | "SIGN_UP" | "GET_OFFER";
};

export async function createAdCreative(
  adAccountId: string,
  input: CreateAdCreativeInput,
): Promise<{ id: string }> {
  const accountPath = normalizeAdAccountId(adAccountId);
  if (!accountPath) {
    throw new MetaApiError("Reklam hesabı ID gerekli", 400);
  }

  const linkData: Record<string, unknown> = {
    link: input.websiteUrl,
    message: input.primaryText,
    image_hash: input.imageHash,
    name: input.headline,
    call_to_action: {
      type: input.ctaType,
      value: { link: input.websiteUrl },
    },
  };
  if (input.description) linkData.description = input.description;

  const objectStorySpec: Record<string, unknown> = {
    page_id: input.pageId,
    link_data: linkData,
  };
  if (input.instagramActorId) {
    objectStorySpec.instagram_actor_id = input.instagramActorId;
  }

  const body: Record<string, string> = {
    name: input.name.trim(),
    object_story_spec: JSON.stringify(objectStorySpec),
  };

  return metaRequest<{ id: string }>(`${accountPath}/adcreatives`, { method: "POST", body });
}

export type MetaPage = { id: string; name: string };
export async function getFacebookPages(): Promise<MetaPage[]> {
  const result = await metaRequest<{ data?: MetaPage[] }>("me/accounts?fields=id,name&limit=200");
  return result.data ?? [];
}

export type MetaPixel = { id: string; name?: string };
export async function getPixels(adAccountId: string): Promise<MetaPixel[]> {
  const accountPath = normalizeAdAccountId(adAccountId);
  const result = await metaRequest<{ data?: MetaPixel[] }>(`${accountPath}/pixels?fields=id,name&limit=200`);
  return result.data ?? [];
}

export type MetaInstagramAccount = { id: string; username?: string; name?: string };
export async function getInstagramAccountsForPage(pageId: string): Promise<MetaInstagramAccount[]> {
  // Basit: Page üzerinden instagram_business_account çekiyoruz.
  const result = await metaRequest<{
    instagram_business_account?: MetaInstagramAccount & { profile_picture_url?: string };
    connected_instagram_account?: MetaInstagramAccount & { profile_picture_url?: string };
  }>(`${pageId}?fields=instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}`);
  const accounts = [
    result.instagram_business_account,
    result.connected_instagram_account,
  ].filter(Boolean) as Array<MetaInstagramAccount & { profile_picture_url?: string }>;
  // dedupe
  const map = new Map<string, MetaInstagramAccount & { profile_picture_url?: string }>();
  for (const a of accounts) map.set(a.id, a);
  return Array.from(map.values());
}

export type MetaTargetingLocationType = "country" | "region" | "city";
export type MetaTargetingLocation = {
  key: string;
  name: string;
  type: MetaTargetingLocationType;
  country_code: string;
  country_name?: string;
  region?: string;
  region_id?: string;
  supports_region?: boolean;
  supports_radius?: boolean;
};

export async function searchTargetingLocations(input: {
  query: string;
  countryCode?: string;
  locationType: MetaTargetingLocationType;
  connectionId?: string;
}): Promise<MetaTargetingLocation[]> {
  const q = input.query.trim();
  if (!q) return [];

  const params = new URLSearchParams();
  params.set("type", "adgeolocation");
  params.set("q", q);
  params.set("limit", "25");
  params.set("location_types", JSON.stringify([input.locationType]));
  if (input.countryCode?.trim()) {
    params.set("countries", JSON.stringify([input.countryCode.trim().toUpperCase()]));
  }

  const result = await metaRequest<{ data?: MetaTargetingLocation[] }>(
    `search?${params.toString()}`,
    { connectionId: input.connectionId },
  );
  return result.data ?? [];
}

type PagedResult<T> = {
  data: T[];
  paging?: { next?: string };
};

async function fetchPaged<T>(initialPath: string, max = 100, token?: string): Promise<T[]> {
  const baseUrl = graphBaseUrl();
  let nextPath: string | null = initialPath;
  const results: T[] = [];

  while (nextPath && results.length < max) {
    const page: PagedResult<T> = await metaRequest(nextPath, { token });
    if (page.data) {
      results.push(...page.data);
    }

    if (page.paging?.next && results.length < max) {
      nextPath = page.paging.next.replace(`${baseUrl}/`, "");
    } else {
      nextPath = null;
    }
  }

  return results.slice(0, max);
}

export async function updateCampaign(
  id: string,
  input: { name?: string; status?: "ACTIVE" | "PAUSED" },
): Promise<Campaign> {
  const body: Record<string, string> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.status !== undefined) body.status = input.status;

  await metaRequest(`${id}`, { method: "POST", body });
  return metaRequest<Campaign>(
    `${id}?fields=id,name,objective,status,effective_status,created_time,updated_time`,
  );
}

export async function updateAdSet(
  id: string,
  input: { name?: string; status?: "ACTIVE" | "PAUSED"; dailyBudget?: number },
): Promise<AdSet> {
  const body: Record<string, string | number> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.status !== undefined) body.status = input.status;
  if (input.dailyBudget !== undefined) {
    body.daily_budget = Math.round(input.dailyBudget * 100);
  }

  await metaRequest(`${id}`, { method: "POST", body });
  return metaRequest<AdSet>(
    `${id}?fields=id,campaign_id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,targeting`,
  );
}

export async function updateAd(
  id: string,
  input: { name?: string; status?: "ACTIVE" | "PAUSED" },
): Promise<Ad> {
  const body: Record<string, string> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.status !== undefined) body.status = input.status;

  await metaRequest(`${id}`, { method: "POST", body });
  return metaRequest<Ad>(
    `${id}?fields=id,name,campaign_id,adset_id,status,effective_status,created_time,updated_time,creative{id,name,thumbnail_url},issues_info,ad_review_feedback`,
  );
}
