import "server-only";
import { getMetaConnection, getMetaConnectionById, listLinkedAdAccounts, updateMetaBusinessId } from "./db";
import { extractMetaErrorMessage } from "./meta-errors";
import {
  normalizeAdAccountId,
  normalizeAdAccountList,
  normalizeAdAccountRecord,
  type AdAccountRaw,
} from "@/utils/ad-account";
import type { BuyingType, CampaignObjective, CampaignStatus, SpecialAdCategoryApi } from "@/utils/campaign-constants";
import type {
  MetaAssetDiagnostics,
  MetaInstagramOption,
  MetaLocationOption,
  MetaPageOption,
  MetaPixelOption,
} from "@/types/meta-assets";

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
): Promise<{ metaUserId: string | null; metaUserName: string | null; metaBusinessId: string | null }> {
  let metaUserId: string | null = null;
  let metaUserName: string | null = null;
  let metaBusinessId: string | null = null;

  try {
    const me = await metaRequest<{ id: string; name?: string }>("me?fields=id,name", {
      token: accessToken,
    });
    metaUserId = me.id;
    metaUserName = me.name?.trim() || null;
  } catch {
    return { metaUserId: null, metaUserName: null, metaBusinessId: null };
  }

  try {
    const businesses = await getBusinesses({ token: accessToken });
    if (businesses.length > 0) {
      metaBusinessId = businesses[0].id;
      metaUserName = businesses[0].name.trim();
    }
  } catch {
    // me.name veya mevcut değer korunur
  }

  return { metaUserId, metaUserName, metaBusinessId };
}

export async function getBusinessIdFromAdAccount(
  adAccountId: string,
  options?: { connectionId?: string; token?: string },
): Promise<string | null> {
  const accountPath = normalizeAdAccountId(adAccountId);
  if (!accountPath) return null;

  try {
    const result = await metaRequest<{ business?: { id?: string } }>(
      `${accountPath}?fields=business{id}`,
      options,
    );
    return result.business?.id?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function ensureMetaBusinessId(connectionId?: string): Promise<string | null> {
  const connection = connectionId
    ? await getMetaConnectionById(connectionId)
    : await getMetaConnection();
  if (!connection) return null;
  if (connection.metaBusinessId?.trim()) return connection.metaBusinessId.trim();

  const adAccountCandidates = new Set<string>();
  if (connection.selectedAdAccountId?.trim()) {
    adAccountCandidates.add(connection.selectedAdAccountId.trim());
  }
  const linked = await listLinkedAdAccounts(connection.id);
  for (const account of linked) {
    if (account.id?.trim()) adAccountCandidates.add(account.id.trim());
  }

  for (const adAccountId of adAccountCandidates) {
    const fromAccount = await getBusinessIdFromAdAccount(adAccountId, {
      connectionId: connection.id,
    });
    if (fromAccount) {
      await updateMetaBusinessId(connection.id, fromAccount);
      return fromAccount;
    }
  }

  try {
    const businesses = await getBusinesses({ token: connection.accessToken });
    const businessId = businesses[0]?.id?.trim() ?? null;
    if (businessId) {
      await updateMetaBusinessId(connection.id, businessId);
    }
    return businessId;
  } catch {
    return null;
  }
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

export type MetaPage = { id: string; name: string; picture?: { data?: { url?: string } } };

export type MetaPagesDiagnostics = {
  userAccountsCount: number;
  businessOwnedCount: number;
  businessClientCount: number;
  adAccountCount: number;
  userAccountsError?: string;
  adAccountError?: string;
  missingPermissions: string[];
  hint?: string;
};

export type MetaPagesResult = {
  pages: MetaPage[];
  diagnostics: MetaPagesDiagnostics;
};

const PAGE_LIST_PERMISSIONS = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_ads",
  "business_management",
  "ads_management",
  "ads_read",
] as const;

async function getGrantedPermissions(connectionId?: string): Promise<string[]> {
  try {
    const result = await metaRequest<{ data?: Array<{ permission: string; status: string }> }>(
      "me/permissions",
      { connectionId },
    );
    return (result.data ?? [])
      .filter((item) => item.status === "granted")
      .map((item) => item.permission);
  } catch {
    return [];
  }
}

export async function getFacebookPageOptions(input?: {
  connectionId?: string;
  adAccountId?: string;
  businessId?: string;
}): Promise<{ pages: MetaPageOption[]; diagnostics: MetaPagesDiagnostics }> {
  const byId = new Map<string, MetaPageOption>();
  const diagnostics: MetaPagesDiagnostics = {
    userAccountsCount: 0,
    businessOwnedCount: 0,
    businessClientCount: 0,
    adAccountCount: 0,
    missingPermissions: [],
  };

  const addPages = (items: MetaPage[], source: MetaPageOption["source"]) => {
    for (const page of items) {
      if (!page?.id) continue;
      if (!byId.has(page.id)) {
        byId.set(page.id, {
          id: page.id,
          name: page.name,
          pictureUrl: page.picture?.data?.url,
          source,
        });
      }
    }
  };

  const connection = input?.connectionId
    ? await getMetaConnectionById(input.connectionId)
    : await getMetaConnection();
  const businessId =
    input?.businessId?.trim() ||
    connection?.metaBusinessId?.trim() ||
    (connection ? await ensureMetaBusinessId(connection.id) : null) ||
    "";

  const granted = await getGrantedPermissions(input?.connectionId);
  diagnostics.missingPermissions = PAGE_LIST_PERMISSIONS.filter(
    (permission) => !granted.includes(permission),
  );

  const token = await getStoredAccessToken(input?.connectionId);

  if (businessId) {
    try {
      const owned = await fetchPaged<MetaPage>(
        `${businessId}/owned_pages?fields=id,name,picture{url}&limit=200`,
        200,
        token,
      );
      addPages(owned, "business_owned");
      diagnostics.businessOwnedCount += owned.length;
    } catch (error) {
      diagnostics.userAccountsError =
        error instanceof Error ? error.message : "owned_pages isteği başarısız";
    }
    try {
      const client = await fetchPaged<MetaPage>(
        `${businessId}/client_pages?fields=id,name,picture{url}&limit=200`,
        200,
        token,
      );
      addPages(client, "business_client");
      diagnostics.businessClientCount += client.length;
    } catch {
      // ignore
    }
  }

  try {
    const result = await metaRequest<{ data?: MetaPage[] }>(
      "me/accounts?fields=id,name,picture{url}&limit=200",
      { connectionId: input?.connectionId },
    );
    if (result.data) {
      addPages(result.data, "user");
      diagnostics.userAccountsCount = result.data.length;
    }
  } catch (error) {
    if (!diagnostics.userAccountsError) {
      diagnostics.userAccountsError =
        error instanceof Error ? error.message : "me/accounts isteği başarısız";
    }
  }

  const accountPath = input?.adAccountId ? normalizeAdAccountId(input.adAccountId) : "";
  if (accountPath) {
    try {
      const promoted = await fetchPaged<MetaPage>(
        `${accountPath}/promote_pages?fields=id,name,picture{url}&limit=200`,
        200,
        token,
      );
      addPages(promoted, "ad_account");
      diagnostics.adAccountCount = promoted.length;
    } catch (error) {
      diagnostics.adAccountError =
        error instanceof Error ? error.message : "promote_pages isteği başarısız";
    }
  }

  const pages = Array.from(byId.values());

  if (pages.length === 0) {
    const missingPagePerms = ["pages_show_list", "pages_manage_ads"].filter((permission) =>
      diagnostics.missingPermissions.includes(permission),
    );
    if (missingPagePerms.length > 0) {
      diagnostics.hint = `Facebook Page listeleme yetkisi bulunmuyor: ${missingPagePerms.join(", ")}.`;
    } else if (!businessId && !accountPath) {
      diagnostics.hint =
        "İşletme (Business) ID bulunamadı. Ayarlar'dan reklam hesabı ekleyin veya Business Manager ID girin.";
    } else if (!businessId && accountPath) {
      diagnostics.hint =
        "Reklam hesabından Business ID çözülemedi. Token'ın bu hesaba erişimi olduğundan emin olun veya Ayarlar'dan Business Manager ID girin.";
    } else if (diagnostics.userAccountsError && diagnostics.adAccountError) {
      diagnostics.hint = `Page API hataları — kullanıcı: ${diagnostics.userAccountsError}; reklam hesabı: ${diagnostics.adAccountError}`;
    } else if (diagnostics.adAccountError) {
      diagnostics.hint = `Reklam hesabı Page listesi alınamadı: ${diagnostics.adAccountError}`;
    } else if (diagnostics.userAccountsError) {
      diagnostics.hint = `Kullanıcı Page listesi alınamadı: ${diagnostics.userAccountsError}`;
    } else {
      diagnostics.hint = `Business ${businessId} altında erişilebilir Facebook Page bulunamadı.`;
    }
  }

  return { pages, diagnostics };
}

export async function getFacebookPages(options?: {
  connectionId?: string;
  adAccountId?: string;
  businessId?: string;
}): Promise<MetaPagesResult> {
  const { pages: pageOptions, diagnostics } = await getFacebookPageOptions(options);
  const pages: MetaPage[] = pageOptions.map((page) => ({
    id: page.id,
    name: page.name,
    picture: page.pictureUrl ? { data: { url: page.pictureUrl } } : undefined,
  }));
  return { pages, diagnostics };
}

export type MetaPixel = { id: string; name?: string; last_fired_time?: string };

export type PixelsFetchResult = {
  pixels: MetaPixelOption[];
  requestSucceeded: boolean;
  adAccountRequestSucceeded: boolean;
  businessRequestSucceeded: boolean;
  adAccountError?: string;
  businessError?: string;
  reason?: string;
  detail?: string;
};

export async function getPixelsForAdAccount(input: {
  adAccountId: string;
  connectionId?: string;
  businessId?: string;
}): Promise<PixelsFetchResult> {
  const token = await getStoredAccessToken(input.connectionId);
  const businessId =
    input.businessId?.trim() ||
    (input.connectionId
      ? await ensureMetaBusinessId(input.connectionId)
      : (await getMetaConnection())?.metaBusinessId?.trim() ?? null);

  const byId = new Map<string, MetaPixelOption>();
  const accountPixelIds = new Set<string>();
  let adAccountRequestSucceeded = false;
  let businessRequestSucceeded = false;
  let adAccountError: string | undefined;
  let businessError: string | undefined;

  const accountPath = normalizeAdAccountId(input.adAccountId);
  if (accountPath) {
    try {
      const fromAccount = await fetchPaged<MetaPixel>(
        `${accountPath}/adspixels?fields=id,name,last_fired_time&limit=200`,
        200,
        token,
      );
      adAccountRequestSucceeded = true;
      for (const pixel of fromAccount) {
        if (!pixel?.id) continue;
        accountPixelIds.add(pixel.id);
        byId.set(pixel.id, {
          id: pixel.id,
          name: pixel.name?.trim() || `Pixel ${pixel.id}`,
          lastFiredTime: pixel.last_fired_time,
          source: "ad_account",
          available: true,
        });
      }
    } catch (error) {
      adAccountError = error instanceof Error ? error.message : "Reklam hesabı Pixel isteği başarısız";
    }
  } else {
    adAccountError = "Reklam hesabı ID geçersiz";
  }

  if (businessId) {
    try {
      const fromBusiness = await fetchPaged<MetaPixel>(
        `${businessId}/adspixels?fields=id,name,last_fired_time&limit=200`,
        200,
        token,
      );
      businessRequestSucceeded = true;
      for (const pixel of fromBusiness) {
        if (!pixel?.id || byId.has(pixel.id)) continue;
        byId.set(pixel.id, {
          id: pixel.id,
          name: pixel.name?.trim() || `Pixel ${pixel.id}`,
          lastFiredTime: pixel.last_fired_time,
          source: "business",
          available: false,
        });
      }
    } catch (error) {
      businessError = error instanceof Error ? error.message : "Business Pixel isteği başarısız";
    }
  }

  const pixels = Array.from(byId.values());
  const availableCount = pixels.filter((pixel) => pixel.available).length;
  const requestSucceeded = adAccountRequestSucceeded || businessRequestSucceeded;

  let reason: string | undefined;
  let detail: string | undefined;

  if (availableCount > 0) {
    reason = undefined;
  } else if (!requestSucceeded) {
    if (adAccountError?.includes("OAuth") || businessError?.includes("OAuth")) {
      reason = "Token geçersiz veya süresi dolmuş";
    } else if (adAccountError?.includes("permission") || businessError?.includes("permission")) {
      reason = "Meta permission hatası";
      detail = adAccountError ?? businessError;
    } else {
      reason = "Meta API isteği başarısız";
      detail = adAccountError ?? businessError;
    }
  } else if (pixels.length > 0) {
    reason = "Pixel var fakat bu reklam hesabında kullanılamıyor";
    detail = "Business altında Pixel bulundu ancak seçili reklam hesabına atanmamış.";
  } else if (adAccountRequestSucceeded || businessRequestSucceeded) {
    reason = "Reklam hesabına atanmış Pixel bulunamadı";
  } else if (adAccountError) {
    reason = "Reklam hesabı hatalı";
    detail = adAccountError;
  }

  return {
    pixels,
    requestSucceeded,
    adAccountRequestSucceeded,
    businessRequestSucceeded,
    adAccountError,
    businessError,
    reason,
    detail,
  };
}

export async function getPixels(options: {
  adAccountId: string;
  connectionId?: string;
  businessId?: string;
}): Promise<MetaPixel[]> {
  const result = await getPixelsForAdAccount(options);
  return result.pixels.filter((pixel) => pixel.available).map((pixel) => ({
    id: pixel.id,
    name: pixel.name,
  }));
}

export type MetaInstagramAccount = {
  id: string;
  username?: string;
  name?: string;
  profilePictureUrl?: string;
  pageId?: string;
  pageName?: string;
};

export async function getInstagramAccountsForPage(
  pageId: string,
  options?: { connectionId?: string; pageName?: string },
): Promise<MetaInstagramOption[]> {
  const result = await metaRequest<{
    instagram_business_account?: MetaInstagramAccount & { profile_picture_url?: string };
    connected_instagram_account?: MetaInstagramAccount & { profile_picture_url?: string };
  }>(
    `${pageId}?fields=instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}`,
    { connectionId: options?.connectionId },
  );

  const raw = [result.instagram_business_account, result.connected_instagram_account].filter(
    Boolean,
  ) as Array<MetaInstagramAccount & { profile_picture_url?: string }>;

  const map = new Map<string, MetaInstagramOption>();
  for (const account of raw) {
    map.set(account.id, {
      id: account.id,
      username: account.username,
      name: account.name,
      profilePictureUrl: account.profile_picture_url,
      pageId,
      pageName: options?.pageName,
    });
  }
  return Array.from(map.values());
}

export type MetaTargetingLocationType = "country" | "region" | "city" | "zip";
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

function toAsciiTurkish(input: string): string {
  return input
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c");
}

function normalizeLocationName(input: string): string {
  return toAsciiTurkish(input).toLowerCase().trim();
}

function buildLocationQueries(input: {
  cityName?: string;
  regionName?: string;
  displayName?: string;
  countryCode?: string;
}): string[] {
  const countryLabel = input.countryCode?.trim().toUpperCase() === "TR" ? "Turkey" : "";
  const raw = [
    input.cityName,
    input.regionName,
    input.displayName?.split(",")[0]?.trim(),
    input.cityName && countryLabel ? `${input.cityName}, ${countryLabel}` : undefined,
    input.regionName && countryLabel ? `${input.regionName}, ${countryLabel}` : undefined,
  ].filter((value): value is string => Boolean(value?.trim()));

  const queries = new Set<string>();
  for (const value of raw) {
    const trimmed = value.trim();
    queries.add(trimmed);
    const ascii = toAsciiTurkish(trimmed);
    if (ascii !== trimmed) queries.add(ascii);
  }
  return Array.from(queries);
}

function pickBestTargetingMatch(
  candidates: MetaTargetingLocation[],
  query: string,
  countryCode?: string,
): MetaTargetingLocation | null {
  if (candidates.length === 0) return null;

  const normalizedQuery = normalizeLocationName(query);
  const country = countryCode?.trim().toUpperCase();

  const filtered = country
    ? candidates.filter((item) => item.country_code?.toUpperCase() === country)
    : candidates;
  const pool = filtered.length > 0 ? filtered : candidates;

  const exact = pool.find((item) => normalizeLocationName(item.name) === normalizedQuery);
  if (exact) return exact;

  const startsWith = pool.find((item) =>
    normalizeLocationName(item.name).startsWith(normalizedQuery),
  );
  if (startsWith) return startsWith;

  const contains = pool.find((item) => normalizeLocationName(item.name).includes(normalizedQuery));
  if (contains) return contains;

  return pool[0] ?? null;
}

function normalizeTargetingLocation(
  raw: Partial<MetaTargetingLocation> & { key?: string | number },
  fallbackType?: MetaTargetingLocationType,
): MetaTargetingLocation | null {
  const key = raw.key === undefined || raw.key === null ? "" : String(raw.key).trim();
  const name = raw.name?.trim() ?? "";
  if (!key || !name) return null;

  const type =
    raw.type === "country" ||
    raw.type === "region" ||
    raw.type === "city" ||
    raw.type === "zip"
      ? raw.type
      : fallbackType ?? "city";

  return {
    key,
    name,
    type,
    country_code: raw.country_code?.trim().toUpperCase() ?? "",
    country_name: raw.country_name,
    region: raw.region,
    region_id: raw.region_id === undefined ? undefined : String(raw.region_id),
    supports_region: raw.supports_region,
    supports_radius: raw.supports_radius,
  };
}

function buildTargetingSearchPath(input: {
  query: string;
  countryCode?: string;
  locationTypes?: MetaTargetingLocationType[];
  limit?: number;
}): string {
  const parts = [
    `type=adgeolocation`,
    `q=${encodeURIComponent(input.query.trim())}`,
    `limit=${input.limit ?? 25}`,
  ];
  if (input.locationTypes?.length) {
    parts.push(`location_types=${encodeURIComponent(JSON.stringify(input.locationTypes))}`);
  }
  if (input.countryCode?.trim()) {
    parts.push(`country_code=${encodeURIComponent(input.countryCode.trim().toUpperCase())}`);
  }
  return `search?${parts.join("&")}`;
}

export async function searchTargetingLocations(input: {
  query: string;
  countryCode?: string;
  locationType?: MetaTargetingLocationType | MetaTargetingLocationType[];
  connectionId?: string;
  limit?: number;
}): Promise<MetaTargetingLocation[]> {
  const q = input.query.trim();
  if (!q) return [];

  const locationTypes = input.locationType
    ? Array.isArray(input.locationType)
      ? input.locationType
      : [input.locationType]
    : undefined;

  const result = await metaRequest<{ data?: Array<Partial<MetaTargetingLocation> & { key?: string | number }> }>(
    buildTargetingSearchPath({
      query: q,
      countryCode: input.countryCode,
      locationTypes,
      limit: input.limit,
    }),
    { connectionId: input.connectionId },
  );

  const fallbackType = Array.isArray(locationTypes) ? locationTypes[0] : locationTypes;
  return (result.data ?? [])
    .map((item) => normalizeTargetingLocation(item, fallbackType))
    .filter((item): item is MetaTargetingLocation => Boolean(item));
}

export async function resolveMetaGeoLocation(input: {
  cityName?: string;
  regionName?: string;
  displayName?: string;
  countryCode: string;
  connectionId?: string;
  adAccountId?: string;
}): Promise<{ city?: MetaTargetingLocation; region?: MetaTargetingLocation; error?: string }> {
  const countryCode = input.countryCode.trim().toUpperCase();
  const queries = buildLocationQueries({ ...input, countryCode });
  if (queries.length === 0) {
    return { error: "Konum adı bulunamadı" };
  }

  let lastError: string | undefined;

  for (const query of queries) {
    const attempts: Array<{
      run: () => Promise<MetaTargetingLocation[]>;
      pick: (items: MetaTargetingLocation[]) => MetaTargetingLocation | null;
    }> = [
      {
        run: () =>
          searchTargetingLocations({
            query,
            countryCode,
            locationType: "city",
            connectionId: input.connectionId,
            limit: 25,
          }),
        pick: (items) => items.find((item) => item.type === "city") ?? items[0] ?? null,
      },
      {
        run: () =>
          searchTargetingLocations({
            query,
            countryCode,
            locationType: "region",
            connectionId: input.connectionId,
            limit: 25,
          }),
        pick: (items) => items.find((item) => item.type === "region") ?? items[0] ?? null,
      },
      {
        run: () =>
          searchTargetingLocations({
            query,
            countryCode,
            locationType: ["city", "region"],
            connectionId: input.connectionId,
            limit: 25,
          }),
        pick: (items) => pickBestTargetingMatch(items, query, countryCode),
      },
      {
        run: () =>
          searchTargetingLocations({
            query,
            countryCode,
            connectionId: input.connectionId,
            limit: 25,
          }),
        pick: (items) => pickBestTargetingMatch(items, query, countryCode),
      },
      {
        run: () =>
          searchTargetingLocations({
            query,
            connectionId: input.connectionId,
            limit: 25,
          }),
        pick: (items) => pickBestTargetingMatch(items, query, countryCode),
      },
    ];

    for (const attempt of attempts) {
      try {
        const items = await attempt.run();
        const match = attempt.pick(items);
        if (!match) continue;
        if (match.type === "region") return { region: match };
        return { city: match };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Meta konum araması başarısız";
      }
    }
  }

  if (lastError) return { error: lastError };
  return { error: "Meta hedefleme kataloğunda eşleşen konum bulunamadı" };
}

export function toMetaLocationOption(location: MetaTargetingLocation): MetaLocationOption {
  const parts = [location.name];
  if (location.region && location.type === "city") parts.push(location.region);
  if (location.country_name) parts.push(location.country_name);
  else if (location.country_code) parts.push(location.country_code);

  return {
    key: location.key,
    name: location.name,
    type: location.type,
    countryCode: location.country_code,
    countryName: location.country_name,
    regionName: location.region,
    displayName: parts.join(", "),
  };
}

export async function searchMetaLocationOptions(input: {
  query: string;
  countryCode?: string;
  connectionId?: string;
  limit?: number;
}): Promise<MetaLocationOption[]> {
  const items = await searchTargetingLocations({
    query: input.query,
    countryCode: input.countryCode,
    connectionId: input.connectionId,
    limit: input.limit ?? 25,
  });
  return items.map(toMetaLocationOption);
}

export async function verifyAdAccountAccess(input: {
  connectionId?: string;
  adAccountId: string;
}): Promise<{ accessible: boolean; normalizedId?: string; reason?: string }> {
  const normalizedId = normalizeAdAccountId(input.adAccountId);
  if (!normalizedId) {
    return { accessible: false, reason: "Reklam hesabı ID geçersiz" };
  }

  try {
    await metaRequest<{ id?: string; name?: string }>(`${normalizedId}?fields=id,name`, {
      connectionId: input.connectionId,
    });
    return { accessible: true, normalizedId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reklam hesabına erişilemedi";
    if (message.includes("OAuth") || message.includes("access token")) {
      return { accessible: false, normalizedId, reason: "Token geçersiz veya süresi dolmuş" };
    }
    if (message.includes("permission")) {
      return { accessible: false, normalizedId, reason: "Meta permission hatası" };
    }
    return { accessible: false, normalizedId, reason: message };
  }
}

export async function getMetaAssetDiagnostics(input: {
  connectionId: string;
  businessId?: string;
  adAccountId: string;
  pageId?: string;
  locationQuery?: string;
  countryCode?: string;
}): Promise<MetaAssetDiagnostics> {
  const granted = await getGrantedPermissions(input.connectionId);
  const missing = PAGE_LIST_PERMISSIONS.filter((permission) => !granted.includes(permission));

  const adAccount = await verifyAdAccountAccess({
    connectionId: input.connectionId,
    adAccountId: input.adAccountId,
  });

  let locationsAvailable = false;
  let locationsReason: string | undefined;
  if (input.locationQuery?.trim()) {
    try {
      const locationItems = await searchMetaLocationOptions({
        query: input.locationQuery,
        countryCode: input.countryCode,
        connectionId: input.connectionId,
      });
      locationsAvailable = locationItems.length > 0;
      if (!locationsAvailable) {
        locationsReason = "Meta konum araması sonuç döndürmedi";
      }
    } catch (error) {
      locationsReason =
        error instanceof Error ? error.message : "Meta konum araması başarısız oldu";
    }
  } else {
    locationsAvailable = true;
  }

  const businessId =
    input.businessId?.trim() ||
    (await ensureMetaBusinessId(input.connectionId)) ||
    undefined;

  const pageResult = await getFacebookPageOptions({
    connectionId: input.connectionId,
    adAccountId: input.adAccountId,
    businessId,
  });

  const pixelResult = await getPixelsForAdAccount({
    connectionId: input.connectionId,
    adAccountId: input.adAccountId,
    businessId,
  });

  let instagramCount = 0;
  let instagramSucceeded = true;
  let instagramReason: string | undefined;
  if (input.pageId) {
    try {
      const instagram = await getInstagramAccountsForPage(input.pageId, {
        connectionId: input.connectionId,
        pageName: pageResult.pages.find((page) => page.id === input.pageId)?.name,
      });
      instagramCount = instagram.length;
      if (instagramCount === 0) {
        instagramReason = "Seçilen Page'e bağlı Instagram hesabı bulunamadı";
      }
    } catch (error) {
      instagramSucceeded = false;
      instagramReason =
        error instanceof Error ? error.message : "Instagram hesapları alınamadı";
    }
  }

  let pagesReason = pageResult.diagnostics.hint;
  if (pageResult.pages.length === 0 && missing.length > 0) {
    pagesReason = "Facebook Page listeleme yetkisi bulunmuyor";
  }

  const pixelsReason = pixelResult.reason;

  return {
    adAccount,
    locations: {
      available: locationsAvailable,
      reason: locationsReason,
    },
    pages: {
      requestSucceeded: !pageResult.diagnostics.userAccountsError || pageResult.pages.length > 0,
      count: pageResult.pages.length,
      reason: pagesReason,
    },
    instagram: {
      requestSucceeded: instagramSucceeded,
      count: instagramCount,
      reason: instagramReason,
    },
    pixels: {
      requestSucceeded: pixelResult.requestSucceeded,
      count: pixelResult.pixels.filter((pixel) => pixel.available).length,
      reason: pixelsReason,
    },
    missingPermissions: missing,
  };
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
