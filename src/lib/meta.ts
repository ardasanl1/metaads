import "server-only";
import { getMetaConnection, getMetaConnectionById, listLinkedAdAccounts, updateMetaBusinessProfile } from "./db";
import {
  discoverBusinessForAdAccount,
  pickPreferredBusinessMatch,
} from "./meta-business-discovery";
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
import { formatPageOptionLabel, isMissingPageDisplayName } from "@/utils/meta-page";

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

export { graphBaseUrl };

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
    }
  } catch {
    // me.name korunur
  }

  return { metaUserId, metaUserName, metaBusinessId };
}

export async function ensureMetaBusinessId(
  connectionId?: string,
  preferredAdAccountId?: string,
): Promise<string | null> {
  const connection = connectionId
    ? await getMetaConnectionById(connectionId)
    : await getMetaConnection();
  if (!connection) return null;
  if (connection.metaBusinessId?.trim()) return connection.metaBusinessId.trim();

  const adAccountCandidates = new Set<string>();
  if (preferredAdAccountId?.trim()) {
    adAccountCandidates.add(preferredAdAccountId.trim());
  }
  if (connection.selectedAdAccountId?.trim()) {
    adAccountCandidates.add(connection.selectedAdAccountId.trim());
  }
  const linked = await listLinkedAdAccounts(connection.id);
  for (const account of linked) {
    if (account.id?.trim()) adAccountCandidates.add(account.id.trim());
  }

  for (const adAccountId of adAccountCandidates) {
    const discovery = await discoverBusinessForAdAccount({
      connectionId: connection.id,
      adAccountId,
    });
    const match = pickPreferredBusinessMatch(discovery.matches);
    if (match) {
      await updateMetaBusinessProfile(connection.id, {
        metaBusinessId: match.businessId,
        metaBusinessName: match.businessName,
      });
      return match.businessId;
    }
  }

  try {
    const businesses = await getBusinesses({ token: connection.accessToken });
    const businessId = businesses[0]?.id?.trim() ?? null;
    if (businessId) {
      await updateMetaBusinessProfile(connection.id, {
        metaBusinessId: businessId,
        metaBusinessName: businesses[0]?.name?.trim() || null,
      });
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
  destinationType?: string;
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
  if (input.destinationType && input.destinationType !== "UNDEFINED") {
    body.destination_type = input.destinationType;
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
  creativeId?: string;
  inlineObjectStorySpec?: Record<string, unknown>;
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

  const creativePayload = input.inlineObjectStorySpec
    ? { object_story_spec: input.inlineObjectStorySpec }
    : input.creativeId
      ? { creative_id: input.creativeId }
      : null;

  if (!creativePayload) {
    throw new MetaApiError("Creative veya inline creative gerekli", 400);
  }

  const body: Record<string, string> = {
    name: input.name.trim(),
    adset_id: input.adSetId,
    status: input.status ?? "PAUSED",
    creative: JSON.stringify(creativePayload),
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
  websiteUrl?: string;
  imageHash: string;
  primaryText: string;
  headline: string;
  description?: string;
  ctaType: string;
  leadGenFormId?: string;
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
    message: input.primaryText,
    image_hash: input.imageHash,
    name: input.headline,
    call_to_action: {
      type: input.ctaType,
      value: input.websiteUrl ? { link: input.websiteUrl } : {},
    },
  };
  if (input.websiteUrl) linkData.link = input.websiteUrl;
  if (input.description) linkData.description = input.description;
  if (input.leadGenFormId) linkData.lead_gen_form_id = input.leadGenFormId;

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

export type MetaPage = {
  id: string;
  name?: string;
  username?: string;
  global_brand_page_name?: string;
  picture?: { data?: { url?: string } };
};

export type MetaPagesDiagnostics = {
  userAccountsCount: number;
  businessOwnedCount: number;
  businessClientCount: number;
  adAccountCount: number;
  assignedPagesCount: number;
  pendingClientPagesCount: number;
  creativePagesCount: number;
  businessesScanned: number;
  userAccountsError?: string;
  assignedPagesError?: string;
  businessPagesError?: string;
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

const PAGE_FETCH_LIMIT = 500;

type PageEdgeFetchResult = {
  pages: MetaPage[];
  error?: string;
};

async function fetchPageEdge(edgeBase: string, token: string): Promise<PageEdgeFetchResult> {
  const fieldVariants = [
    "id,name,username,global_brand_page_name",
    "id,name,username",
    "id,name",
    "",
  ];
  let lastError: string | undefined;

  for (const fields of fieldVariants) {
    try {
      const query = fields
        ? `${edgeBase}?fields=${fields}&limit=200`
        : `${edgeBase}?limit=200`;
      const pages = await fetchPaged<MetaPage>(query, PAGE_FETCH_LIMIT, token);
      return { pages };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Page listesi alınamadı";
      if (!message.includes("pages_read_engagement")) {
        lastError = message;
      }
    }
  }

  return { pages: [], error: lastError };
}

function isIgnorablePagePermissionError(message?: string): boolean {
  if (!message) return false;
  return message.includes("pages_read_engagement") || message.includes("(#10)");
}

function sanitizePageError(message?: string): string | undefined {
  if (!message || isIgnorablePagePermissionError(message)) return undefined;
  return message;
}

function isMissingPageName(id: string, name?: string): boolean {
  return isMissingPageDisplayName(id, name);
}

function pickPageNameFromRow(page: MetaPage): string | undefined {
  const candidates = [page.name, page.global_brand_page_name, page.username];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && !isMissingPageName(page.id, trimmed)) {
      return trimmed;
    }
  }
  return undefined;
}

function mergePageRow(existing: MetaPage | undefined, incoming: MetaPage): MetaPage {
  const resolved = pickPageNameFromRow(incoming);
  const existingResolved = existing ? pickPageNameFromRow(existing) : undefined;
  return {
    id: incoming.id,
    name: resolved ?? existingResolved ?? incoming.name ?? existing?.name,
    username: incoming.username?.trim() || existing?.username,
    global_brand_page_name:
      incoming.global_brand_page_name?.trim() || existing?.global_brand_page_name,
    picture: incoming.picture ?? existing?.picture,
  };
}

function registerPageRows(registry: Map<string, MetaPage>, items: MetaPage[]): void {
  for (const page of items) {
    if (!page?.id) continue;
    registry.set(page.id, mergePageRow(registry.get(page.id), page));
  }
}

const PAGE_NAME_FIELDS = "id,name,username,global_brand_page_name";

async function collectPagesFromNestedFields(input: {
  businessIds: string[];
  accountPath: string;
  token: string;
}): Promise<MetaPage[]> {
  const pages: MetaPage[] = [];

  try {
    const me = await metaRequest<{
      assigned_pages?: { data?: MetaPage[] };
      accounts?: { data?: MetaPage[] };
    }>(
      `me?fields=assigned_pages.limit(200){${PAGE_NAME_FIELDS}},accounts.limit(200){${PAGE_NAME_FIELDS}}`,
      { token: input.token },
    );
    pages.push(...(me.assigned_pages?.data ?? []));
    pages.push(...(me.accounts?.data ?? []));
  } catch {
    // ignore
  }

  for (const businessId of input.businessIds) {
    try {
      const business = await metaRequest<{
        owned_pages?: { data?: MetaPage[] };
        client_pages?: { data?: MetaPage[] };
      }>(
        `${businessId}?fields=owned_pages.limit(200){${PAGE_NAME_FIELDS}},client_pages.limit(200){${PAGE_NAME_FIELDS}}`,
        { token: input.token },
      );
      pages.push(...(business.owned_pages?.data ?? []));
      pages.push(...(business.client_pages?.data ?? []));
    } catch {
      // ignore
    }
  }

  if (input.accountPath) {
    try {
      const account = await metaRequest<{ promote_pages?: { data?: MetaPage[] } }>(
        `${input.accountPath}?fields=promote_pages.limit(200){${PAGE_NAME_FIELDS}}`,
        { token: input.token },
      );
      pages.push(...(account.promote_pages?.data ?? []));
    } catch {
      // ignore
    }
  }

  return pages;
}

function applyRegistryNames(byId: Map<string, MetaPageOption>, registry: Map<string, MetaPage>): void {
  for (const page of byId.values()) {
    const row = registry.get(page.id);
    if (!row) continue;
    const resolved = pickPageNameFromRow(row);
    if (resolved) {
      page.name = resolved;
    }
    const username = row.username?.trim();
    if (username && !isMissingPageName(page.id, username)) {
      page.username = username.replace(/^@/, "");
    }
  }
}

function extractPixelIdFromPromotedObject(value: unknown): string | undefined {
  if (!value) return undefined;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const object = parsed as Record<string, unknown>;
  if (object.pixel_id != null) return String(object.pixel_id);
  if (typeof object.pixel === "object" && object.pixel !== null && "id" in object.pixel) {
    return String((object.pixel as { id: string | number }).id);
  }
  return undefined;
}

async function batchFetchPixelNames(pixelIds: string[], token: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const uniqueIds = [...new Set(pixelIds.filter(Boolean))];

  for (let index = 0; index < uniqueIds.length; index += 50) {
    const chunk = uniqueIds.slice(index, index + 50);
    try {
      const url = `${graphBaseUrl()}?ids=${encodeURIComponent(chunk.join(","))}&fields=${encodeURIComponent("id,name")}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseMetaResponse<
        Record<string, { id?: string; name?: string; error?: { message?: string } }>
      >(response);
      for (const id of chunk) {
        const row = data[id];
        if (row?.error || !row?.name?.trim()) continue;
        names.set(id, row.name.trim());
      }
    } catch {
      // ignore batch pixel lookup failures
    }
  }

  return names;
}

async function discoverPixelsFromAdAccount(accountPath: string, token: string): Promise<MetaPixel[]> {
  const pixelIds = new Set<string>();

  const ingestPromotedObject = (value: unknown) => {
    const pixelId = extractPixelIdFromPromotedObject(value);
    if (pixelId) pixelIds.add(pixelId);
  };

  try {
    const adsets = await fetchPaged<{ promoted_object?: unknown }>(
      `${accountPath}/adsets?fields=promoted_object&limit=200`,
      200,
      token,
    );
    for (const adset of adsets) ingestPromotedObject(adset.promoted_object);
  } catch {
    // ignore
  }

  try {
    const campaigns = await fetchPaged<{ promoted_object?: unknown }>(
      `${accountPath}/campaigns?fields=promoted_object&limit=200`,
      200,
      token,
    );
    for (const campaign of campaigns) ingestPromotedObject(campaign.promoted_object);
  } catch {
    // ignore
  }

  try {
    const ads = await fetchPaged<{ tracking_specs?: Array<Record<string, unknown>> }>(
      `${accountPath}/ads?fields=tracking_specs&limit=200`,
      200,
      token,
    );
    for (const ad of ads) {
      for (const spec of ad.tracking_specs ?? []) {
        const pixel = spec.fb_pixel ?? spec["pixel"];
        if (pixel != null) pixelIds.add(String(pixel));
      }
    }
  } catch {
    // ignore
  }

  if (pixelIds.size === 0) return [];

  const names = await batchFetchPixelNames([...pixelIds], token);
  return [...pixelIds].map((id) => ({
    id,
    name: names.get(id) || `Pixel ${id}`,
  }));
}

function extractPageIdFromObjectStorySpec(spec: unknown): string | undefined {
  if (!spec) return undefined;
  let parsed: unknown = spec;
  if (typeof spec === "string") {
    try {
      parsed = JSON.parse(spec) as unknown;
    } catch {
      return undefined;
    }
  }
  if (typeof parsed === "object" && parsed !== null && "page_id" in parsed) {
    const pageId = (parsed as { page_id?: string | number }).page_id;
    return pageId != null ? String(pageId) : undefined;
  }
  return undefined;
}

async function discoverPagesFromExistingCreatives(
  accountPath: string,
  token: string,
): Promise<MetaPage[]> {
  const pageIds = new Set<string>();

  try {
    const creatives = await fetchPaged<{ object_story_spec?: unknown }>(
      `${accountPath}/adcreatives?fields=object_story_spec&limit=100`,
      100,
      token,
    );
    for (const creative of creatives) {
      const pageId = extractPageIdFromObjectStorySpec(creative.object_story_spec);
      if (pageId) pageIds.add(pageId);
    }
  } catch {
    // ignore
  }

  if (pageIds.size === 0) {
    try {
      const ads = await fetchPaged<{ creative?: { object_story_spec?: unknown } }>(
        `${accountPath}/ads?fields=creative{object_story_spec}&limit=100`,
        100,
        token,
      );
      for (const ad of ads) {
        const pageId = extractPageIdFromObjectStorySpec(ad.creative?.object_story_spec);
        if (pageId) pageIds.add(pageId);
      }
    } catch {
      return [];
    }
  }

  const pages: MetaPage[] = [];
  for (const pageId of pageIds) {
    pages.push({ id: pageId });
  }

  return pages;
}

function buildEmptyPagesHint(input: {
  businessIds: string[];
  accountPath: string;
  diagnostics: MetaPagesDiagnostics;
  primaryBusinessId: string;
}): string {
  const { businessIds, accountPath, diagnostics, primaryBusinessId } = input;
  const missingPagePerms = ["pages_show_list", "pages_manage_ads"].filter((permission) =>
    diagnostics.missingPermissions.includes(permission),
  );

  if (missingPagePerms.length > 0) {
    return `Facebook Page listeleme yetkisi bulunmuyor: ${missingPagePerms.join(", ")}. Token'ı bu izinlerle yenileyin.`;
  }

  if (businessIds.length === 0 && !accountPath) {
    return "İşletme (Business) bulunamadı. Ayarlar'dan reklam hesabı ekleyin veya token'ı yenileyin.";
  }

  if (businessIds.length === 0 && accountPath) {
    return "Reklam hesabından Business çözülemedi. Token'ın bu hesaba erişimi olduğundan emin olun.";
  }

  const scanSummary = [
    `işletme owned ${diagnostics.businessOwnedCount}`,
    `client ${diagnostics.businessClientCount}`,
    `atanmış ${diagnostics.assignedPagesCount}`,
    `reklam hesabı ${diagnostics.adAccountCount}`,
    `me/accounts ${diagnostics.userAccountsCount}`,
  ].join(", ");

  if (diagnostics.userAccountsError && diagnostics.adAccountError) {
    return `Page API hataları — kullanıcı: ${diagnostics.userAccountsError}; reklam hesabı: ${diagnostics.adAccountError}`;
  }
  if (diagnostics.adAccountError) {
    return `Reklam hesabı Page listesi alınamadı: ${diagnostics.adAccountError}`;
  }
  if (diagnostics.userAccountsError) {
    return `Kullanıcı Page listesi alınamadı: ${diagnostics.userAccountsError}`;
  }
  if (diagnostics.assignedPagesError) {
    return `Atanmış Page listesi alınamadı: ${diagnostics.assignedPagesError}`;
  }
  if (diagnostics.businessPagesError) {
    return `Business Page listesi alınamadı: ${diagnostics.businessPagesError}`;
  }

  if (primaryBusinessId) {
    return `${businessIds.length} işletme tarandı (${scanSummary}). System User token kullanıyorsanız Business Manager → System Users altında Page'lerin bu kullanıcıya atandığını ve reklam hesabına bağlı olduğunu doğrulayın.`;
  }

  return `Erişilebilir Facebook Page bulunamadı (${scanSummary}).`;
}

async function collectBusinessIdsForPageDiscovery(input: {
  connectionId?: string;
  adAccountId?: string;
  businessId?: string;
  connection: Awaited<ReturnType<typeof getMetaConnection>> | null;
  token: string;
}): Promise<{ primaryBusinessId: string; businessIds: string[] }> {
  const businessIds = new Set<string>();
  let primaryBusinessId = "";

  const addBusiness = (id?: string | null, preferPrimary = false) => {
    const trimmed = id?.trim();
    if (!trimmed) return;
    businessIds.add(trimmed);
    if (preferPrimary && !primaryBusinessId) {
      primaryBusinessId = trimmed;
    }
  };

  addBusiness(input.businessId, true);
  addBusiness(input.connection?.metaBusinessId, !primaryBusinessId);

  if (input.connection?.id) {
    const ensured = await ensureMetaBusinessId(input.connection.id, input.adAccountId);
    addBusiness(ensured, !primaryBusinessId);
  }

  if (input.connection?.id && input.adAccountId?.trim()) {
    const discovery = await discoverBusinessForAdAccount({
      connectionId: input.connection.id,
      adAccountId: input.adAccountId,
    });
    for (const match of discovery.matches) {
      addBusiness(match.businessId);
    }
    const preferred = pickPreferredBusinessMatch(discovery.matches);
    if (preferred) {
      addBusiness(preferred.businessId, true);
      if (!input.connection.metaBusinessId?.trim()) {
        await updateMetaBusinessProfile(input.connection.id, {
          metaBusinessId: preferred.businessId,
          metaBusinessName: preferred.businessName,
        });
      }
    }
  }

  const businesses = await getBusinesses({ token: input.token });
  for (const business of businesses) {
    addBusiness(business.id);
  }

  if (input.adAccountId?.trim()) {
    try {
      const account = await metaRequest<{ business?: { id?: string } }>(
        `${normalizeAdAccountId(input.adAccountId)}?fields=business{id}`,
        { token: input.token },
      );
      addBusiness(account.business?.id, true);
    } catch {
      // ignore
    }
  }

  if (!primaryBusinessId && businessIds.size > 0) {
    primaryBusinessId = Array.from(businessIds)[0];
  }

  return {
    primaryBusinessId,
    businessIds: Array.from(businessIds),
  };
}

export async function getFacebookPageOptions(input?: {
  connectionId?: string;
  adAccountId?: string;
  businessId?: string;
}): Promise<{ pages: MetaPageOption[]; diagnostics: MetaPagesDiagnostics }> {
  const byId = new Map<string, MetaPageOption>();
  const pageNameRegistry = new Map<string, MetaPage>();
  const diagnostics: MetaPagesDiagnostics = {
    userAccountsCount: 0,
    businessOwnedCount: 0,
    businessClientCount: 0,
    adAccountCount: 0,
    assignedPagesCount: 0,
    pendingClientPagesCount: 0,
    creativePagesCount: 0,
    businessesScanned: 0,
    missingPermissions: [],
  };

  const addPages = (items: MetaPage[], source: MetaPageOption["source"]) => {
    registerPageRows(pageNameRegistry, items);
    for (const page of items) {
      if (!page?.id) continue;
      const resolvedName = pickPageNameFromRow(page);
      const username = page.username?.trim();
      const existing = byId.get(page.id);
      if (!existing) {
        byId.set(page.id, {
          id: page.id,
          name: resolvedName ?? "",
          username: username && !isMissingPageName(page.id, username) ? username.replace(/^@/, "") : undefined,
          pictureUrl: page.picture?.data?.url,
          source,
        });
        continue;
      }
      if (isMissingPageName(existing.id, existing.name) && resolvedName) {
        existing.name = resolvedName;
      }
      if (!existing.username && username && !isMissingPageName(page.id, username)) {
        existing.username = username.replace(/^@/, "");
      }
      if (!existing.pictureUrl && page.picture?.data?.url) {
        existing.pictureUrl = page.picture.data.url;
      }
    }
  };

  const connection = input?.connectionId
    ? await getMetaConnectionById(input.connectionId)
    : await getMetaConnection();

  const granted = await getGrantedPermissions(input?.connectionId);
  diagnostics.missingPermissions = PAGE_LIST_PERMISSIONS.filter(
    (permission) => !granted.includes(permission),
  );

  const token = await getStoredAccessToken(input?.connectionId);
  const { primaryBusinessId, businessIds } = await collectBusinessIdsForPageDiscovery({
    connectionId: input?.connectionId,
    adAccountId: input?.adAccountId,
    businessId: input?.businessId,
    connection,
    token,
  });
  diagnostics.businessesScanned = businessIds.length;

  const accountPath = input?.adAccountId ? normalizeAdAccountId(input.adAccountId) : "";
  registerPageRows(
    pageNameRegistry,
    await collectPagesFromNestedFields({ businessIds, accountPath, token }),
  );

  const businessPageErrors: string[] = [];
  for (const businessId of businessIds) {
    const owned = await fetchPageEdge(`${businessId}/owned_pages`, token);
    addPages(owned.pages, "business_owned");
    diagnostics.businessOwnedCount += owned.pages.length;
    if (owned.error && owned.pages.length === 0) {
      const sanitized = sanitizePageError(owned.error);
      if (sanitized) businessPageErrors.push(`${businessId}/owned_pages: ${sanitized}`);
    }

    const client = await fetchPageEdge(`${businessId}/client_pages`, token);
    addPages(client.pages, "business_client");
    diagnostics.businessClientCount += client.pages.length;
    if (client.error && client.pages.length === 0) {
      const sanitized = sanitizePageError(client.error);
      if (sanitized) businessPageErrors.push(`${businessId}/client_pages: ${sanitized}`);
    }

    const pending = await fetchPageEdge(`${businessId}/pending_client_pages`, token);
    addPages(pending.pages, "pending_client");
    diagnostics.pendingClientPagesCount += pending.pages.length;
  }
  if (businessPageErrors.length > 0) {
    diagnostics.businessPagesError = businessPageErrors[0];
  }

  const userResult = await fetchPageEdge("me/accounts", token);
  addPages(userResult.pages, "user");
  diagnostics.userAccountsCount = userResult.pages.length;
  if (userResult.error && userResult.pages.length === 0) {
    diagnostics.userAccountsError = sanitizePageError(userResult.error);
  }

  const assignedResult = await fetchPageEdge("me/assigned_pages", token);
  addPages(assignedResult.pages, "assigned_user");
  diagnostics.assignedPagesCount = assignedResult.pages.length;
  if (assignedResult.error && assignedResult.pages.length === 0) {
    diagnostics.assignedPagesError = sanitizePageError(assignedResult.error);
  }

  if (accountPath) {
    const promoted = await fetchPageEdge(`${accountPath}/promote_pages`, token);
    addPages(promoted.pages, "ad_account");
    diagnostics.adAccountCount += promoted.pages.length;
    if (promoted.error && promoted.pages.length === 0) {
      diagnostics.adAccountError = sanitizePageError(promoted.error);
    }

    try {
      const account = await metaRequest<{
        promote_pages?: { data?: MetaPage[] };
      }>(`${accountPath}?fields=promote_pages.limit(200){id,name,username,global_brand_page_name}`, { token });
      const nested = account.promote_pages?.data ?? [];
      addPages(nested, "ad_account");
      diagnostics.adAccountCount += nested.length;
    } catch (error) {
      if (!diagnostics.adAccountError) {
        diagnostics.adAccountError = sanitizePageError(
          error instanceof Error ? error.message : "promote_pages alanı okunamadı",
        );
      }
    }

    if (byId.size === 0) {
      const creativePages = await discoverPagesFromExistingCreatives(accountPath, token);
      addPages(creativePages, "existing_creative");
      diagnostics.creativePagesCount = creativePages.length;
    }
  }

  const sourcePriority: Record<MetaPageOption["source"], number> = {
    ad_account: 0,
    assigned_user: 1,
    business_owned: 2,
    business_client: 3,
    pending_client: 4,
    existing_creative: 5,
    user_accounts: 6,
    user: 6,
  };
  const pages = Array.from(byId.values());
  applyRegistryNames(byId, pageNameRegistry);
  for (const page of pages) {
    if (isMissingPageName(page.id, page.name)) {
      page.name = formatPageOptionLabel(page);
    }
  }
  pages.sort((a, b) => {
    const priorityDiff = sourcePriority[a.source] - sourcePriority[b.source];
    if (priorityDiff !== 0) return priorityDiff;
    return a.name.localeCompare(b.name, "tr");
  });

  diagnostics.businessOwnedCount = pages.filter((page) => page.source === "business_owned").length;
  diagnostics.businessClientCount = pages.filter((page) => page.source === "business_client").length;
  diagnostics.pendingClientPagesCount = pages.filter((page) => page.source === "pending_client").length;
  diagnostics.userAccountsCount = pages.filter((page) => page.source === "user").length;
  diagnostics.assignedPagesCount = pages.filter((page) => page.source === "assigned_user").length;
  diagnostics.adAccountCount = pages.filter((page) => page.source === "ad_account").length;
  diagnostics.creativePagesCount = pages.filter((page) => page.source === "existing_creative").length;

  if (pages.length === 0) {
    diagnostics.hint = buildEmptyPagesHint({
      businessIds,
      accountPath,
      diagnostics,
      primaryBusinessId,
    });
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
  const connection = input.connectionId
    ? await getMetaConnectionById(input.connectionId)
    : await getMetaConnection();
  const { businessIds } = await collectBusinessIdsForPageDiscovery({
    connectionId: input.connectionId,
    adAccountId: input.adAccountId,
    businessId: input.businessId,
    connection,
    token,
  });

  const byId = new Map<string, MetaPixelOption>();
  const accountPixelIds = new Set<string>();
  let adAccountRequestSucceeded = false;
  let businessRequestSucceeded = false;
  let adAccountError: string | undefined;
  let businessError: string | undefined;

  const addPixel = (pixel: MetaPixel, source: MetaPixelOption["source"]) => {
    if (!pixel?.id) return;
    const existing = byId.get(pixel.id);
    const available = true;

    if (!existing) {
      byId.set(pixel.id, {
        id: pixel.id,
        name: pixel.name?.trim() || `Pixel ${pixel.id}`,
        lastFiredTime: pixel.last_fired_time,
        source,
        available,
      });
      return;
    }

    if (!existing.available) {
      existing.available = true;
    }
    if (pixel.name?.trim() && (existing.name === `Pixel ${existing.id}` || !existing.name?.trim())) {
      existing.name = pixel.name.trim();
    }
  };

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
        accountPixelIds.add(pixel.id);
        addPixel(pixel, "ad_account");
      }
    } catch (error) {
      adAccountError = error instanceof Error ? error.message : "Reklam hesabı Pixel isteği başarısız";
    }

    try {
      const account = await metaRequest<{
        adspixels?: { data?: MetaPixel[] };
      }>(`${accountPath}?fields=adspixels.limit(200){id,name,last_fired_time}`, { token });
      for (const pixel of account.adspixels?.data ?? []) {
        if (!pixel?.id) continue;
        accountPixelIds.add(pixel.id);
        addPixel(pixel, "ad_account");
      }
      adAccountRequestSucceeded = true;
    } catch (error) {
      if (!adAccountError) {
        adAccountError =
          error instanceof Error ? error.message : "Reklam hesabı adspixels alanı okunamadı";
      }
    }

    try {
      const fromUsage = await discoverPixelsFromAdAccount(accountPath, token);
      if (fromUsage.length > 0) {
        adAccountRequestSucceeded = true;
        for (const pixel of fromUsage) {
          accountPixelIds.add(pixel.id);
          addPixel(pixel, "ad_account");
        }
      }
    } catch {
      // ignore usage-based pixel discovery failures
    }
  } else {
    adAccountError = "Reklam hesabı ID geçersiz";
  }

  const businessPixelErrors: string[] = [];
  for (const businessId of businessIds) {
    try {
      const fromBusiness = await fetchPaged<MetaPixel>(
        `${businessId}/adspixels?fields=id,name,last_fired_time&limit=200`,
        200,
        token,
      );
      businessRequestSucceeded = true;
      for (const pixel of fromBusiness) {
        addPixel(pixel, "business");
      }
    } catch (error) {
      businessPixelErrors.push(
        error instanceof Error ? error.message : `${businessId}/adspixels başarısız`,
      );
    }
  }

  if (businessPixelErrors.length > 0 && !businessRequestSucceeded) {
    businessError = businessPixelErrors[0];
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
    detail =
      "Business altında Pixel bulundu ancak seçili reklam hesabına atanmamış. Business Manager'da Pixel'i reklam hesabıyla paylaşın.";
  } else if (adAccountRequestSucceeded || businessRequestSucceeded) {
    reason = "Reklam hesabına atanmış Pixel bulunamadı";
    if (businessIds.length > 0) {
      detail = `${businessIds.length} işletme tarandı; erişilebilir Pixel bulunamadı.`;
    }
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
  try {
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
  } catch (error) {
    if (error instanceof MetaApiError && error.message.includes("pages_read_engagement")) {
      return [];
    }
    throw error;
  }
}

export async function getAdAccountInfo(
  adAccountId: string,
  options?: { connectionId?: string },
): Promise<{ id: string; name?: string; currency?: string }> {
  const accountPath = normalizeAdAccountId(adAccountId);
  if (!accountPath) {
    throw new MetaApiError("Reklam hesabı ID gerekli", 400);
  }
  const result = await metaRequest<{ id: string; name?: string; currency?: string }>(
    `${accountPath}?fields=id,name,currency`,
    { connectionId: options?.connectionId },
  );
  return { id: result.id, name: result.name, currency: result.currency };
}

export type MetaInstantFormOption = { id: string; name: string };
export type MetaWhatsAppOption = { id: string; name: string; pageId?: string };
export type MetaCatalogOption = { id: string; name: string };
export type MetaProductSetOption = { id: string; name: string; catalogId?: string };
export type MetaAppOption = { id: string; name: string };

export async function getLeadGenFormsForPage(
  pageId: string,
  options?: { connectionId?: string },
): Promise<MetaInstantFormOption[]> {
  try {
    const token = await getStoredAccessToken(options?.connectionId);
    const forms = await fetchPaged<{ id: string; name?: string }>(
      `${pageId}/leadgen_forms?fields=id,name&limit=100`,
      100,
      token,
    );
    return forms.map((form) => ({ id: form.id, name: form.name?.trim() || `Form ${form.id}` }));
  } catch (error) {
    if (error instanceof MetaApiError) return [];
    throw error;
  }
}

export async function getWhatsAppAccountsForPage(
  pageId: string,
  options?: { connectionId?: string },
): Promise<MetaWhatsAppOption[]> {
  try {
    const result = await metaRequest<{
      whatsapp_number?: { id?: string; display_phone_number?: string };
      page_whatsapp_number?: { id?: string; display_phone_number?: string };
    }>(
      `${pageId}?fields=whatsapp_number{id,display_phone_number},page_whatsapp_number{id,display_phone_number}`,
      { connectionId: options?.connectionId },
    );
    const rows = [result.whatsapp_number, result.page_whatsapp_number].filter(Boolean) as Array<{
      id?: string;
      display_phone_number?: string;
    }>;
    return rows
      .filter((row) => row.id)
      .map((row) => ({
        id: row.id!,
        name: row.display_phone_number?.trim() || `WhatsApp ${row.id}`,
        pageId,
      }));
  } catch (error) {
    if (error instanceof MetaApiError) return [];
    throw error;
  }
}

export async function getCatalogsForAdAccount(input: {
  connectionId?: string;
  adAccountId: string;
  businessId?: string;
}): Promise<MetaCatalogOption[]> {
  const catalogs: MetaCatalogOption[] = [];
  const accountPath = normalizeAdAccountId(input.adAccountId);
  const token = await getStoredAccessToken(input.connectionId);
  if (accountPath) {
    try {
      const accountCatalogs = await fetchPaged<{ id: string; name?: string }>(
        `${accountPath}/product_catalogs?fields=id,name&limit=100`,
        100,
        token,
      );
      catalogs.push(
        ...accountCatalogs.map((catalog) => ({
          id: catalog.id,
          name: catalog.name?.trim() || `Katalog ${catalog.id}`,
        })),
      );
    } catch {
      // ignore
    }
  }
  if (input.businessId?.trim()) {
    try {
      const businessCatalogs = await fetchPaged<{ id: string; name?: string }>(
        `${input.businessId.trim()}/owned_product_catalogs?fields=id,name&limit=100`,
        100,
        token,
      );
      for (const catalog of businessCatalogs) {
        if (!catalogs.some((item) => item.id === catalog.id)) {
          catalogs.push({
            id: catalog.id,
            name: catalog.name?.trim() || `Katalog ${catalog.id}`,
          });
        }
      }
    } catch {
      // ignore
    }
  }
  return catalogs;
}

export async function getProductSetsForCatalog(
  catalogId: string,
  options?: { connectionId?: string },
): Promise<MetaProductSetOption[]> {
  try {
    const token = await getStoredAccessToken(options?.connectionId);
    const sets = await fetchPaged<{ id: string; name?: string }>(
      `${catalogId}/product_sets?fields=id,name&limit=100`,
      100,
      token,
    );
    return sets.map((set) => ({
      id: set.id,
      name: set.name?.trim() || `Ürün Seti ${set.id}`,
      catalogId,
    }));
  } catch (error) {
    if (error instanceof MetaApiError) return [];
    throw error;
  }
}

export async function getAppsForAdAccount(input: {
  connectionId?: string;
  adAccountId: string;
}): Promise<MetaAppOption[]> {
  const accountPath = normalizeAdAccountId(input.adAccountId);
  if (!accountPath) return [];
  try {
    const token = await getStoredAccessToken(input.connectionId);
    const apps = await fetchPaged<{ id: string; name?: string }>(
      `${accountPath}/applications?fields=id,name&limit=100`,
      100,
      token,
    );
    return apps.map((app) => ({ id: app.id, name: app.name?.trim() || `Uygulama ${app.id}` }));
  } catch (error) {
    if (error instanceof MetaApiError) return [];
    throw error;
  }
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
