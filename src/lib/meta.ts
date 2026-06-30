import "server-only";
import {
  getMetaConnection,
  getMetaSettingsRecord,
  saveMetaSettingsRecord,
} from "./db";
import { decryptSensitiveValue, encryptSensitiveValue } from "./token-crypto";

export type MetaConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  apiVersion: string;
};

export type SaveMetaConfigInput = {
  appId: string;
  appSecret?: string;
  redirectUri: string;
  apiVersion: string;
};

export type PublicMetaConfig = {
  appId: string;
  redirectUri: string;
  apiVersion: string;
  hasAppSecret: boolean;
};

export class MetaApiError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
  }
}

export async function hasMetaConfig(): Promise<boolean> {
  const record = await getMetaSettingsRecord();
  return Boolean(
    record?.appId &&
      record.appSecretEncrypted &&
      record.redirectUri &&
      record.apiVersion,
  );
}

export async function getMetaConfig(): Promise<MetaConfig> {
  const record = await getMetaSettingsRecord();
  if (!record) {
    throw new MetaApiError("Meta yapilandirmasi eksik", 400);
  }

  return {
    appId: record.appId,
    appSecret: decryptSensitiveValue(record.appSecretEncrypted),
    redirectUri: record.redirectUri,
    apiVersion: record.apiVersion,
  };
}

export async function saveMetaConfig(input: SaveMetaConfigInput): Promise<PublicMetaConfig> {
  const existing = await getMetaSettingsRecord();
  const appSecretEncrypted = input.appSecret
    ? encryptSensitiveValue(input.appSecret)
    : existing?.appSecretEncrypted;

  if (!appSecretEncrypted) {
    throw new MetaApiError("Ilk kayitta Meta App Secret gerekli", 400);
  }

  await saveMetaSettingsRecord({
    appId: input.appId,
    appSecretEncrypted,
    redirectUri: input.redirectUri,
    apiVersion: input.apiVersion,
  });

  return {
    appId: input.appId,
    redirectUri: input.redirectUri,
    apiVersion: input.apiVersion,
    hasAppSecret: true,
  };
}

export async function getPublicMetaConfig(): Promise<PublicMetaConfig | null> {
  const record = await getMetaSettingsRecord();
  if (!record) {
    return null;
  }

  return {
    appId: record.appId,
    redirectUri: record.redirectUri,
    apiVersion: record.apiVersion,
    hasAppSecret: Boolean(record.appSecretEncrypted),
  };
}

function parseMetaErrorMessage(data: {
  error?: { message?: string; type?: string; code?: number };
}): string {
  return data.error?.message || "Meta API istegi basarisiz oldu";
}

async function graphBaseUrl(): Promise<string> {
  const { apiVersion } = await getMetaConfig();
  return `https://graph.facebook.com/${apiVersion}`;
}

export async function buildMetaOAuthUrl(state: string): Promise<string> {
  const { appId, redirectUri, apiVersion } = await getMetaConfig();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: "ads_read,ads_management",
  });

  return `https://www.facebook.com/${apiVersion}/dialog/oauth?${params.toString()}`;
}

async function parseMetaResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & {
    error?: { message?: string; type?: string; code?: number };
  };

  if (!response.ok || data.error) {
    throw new MetaApiError(parseMetaErrorMessage(data), response.ok ? 502 : response.status);
  }

  return data;
}

export async function exchangeCodeForAccessToken(code: string): Promise<{
  access_token: string;
  token_type?: string;
  expires_in?: number;
}> {
  const { appId, appSecret, redirectUri } = await getMetaConfig();
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const response = await fetch(`${await graphBaseUrl()}/oauth/access_token?${params.toString()}`);
  return parseMetaResponse(response);
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{
  access_token: string;
  token_type?: string;
  expires_in?: number;
}> {
  const { appId, appSecret } = await getMetaConfig();
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  const response = await fetch(`${await graphBaseUrl()}/oauth/access_token?${params.toString()}`);
  return parseMetaResponse(response);
}

async function getStoredAccessToken(): Promise<string> {
  const connection = await getMetaConnection();
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
  } = {},
): Promise<T> {
  const token = options.token ?? (await getStoredAccessToken());
  const baseUrl = await graphBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}/${path.replace(/^\//, "")}`;
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

export type AdAccount = {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
};

export async function getAdAccounts(): Promise<AdAccount[]> {
  const data = await metaRequest<{ data: AdAccount[] }>(
    "me/adaccounts?fields=id,name,account_status,currency,timezone_name&limit=100",
  );
  return data.data ?? [];
}

type PagedResult<T> = {
  data: T[];
  paging?: { next?: string };
};

async function fetchPaged<T>(initialPath: string, max = 100): Promise<T[]> {
  const baseUrl = await graphBaseUrl();
  let nextPath: string | null = initialPath;
  const results: T[] = [];

  while (nextPath && results.length < max) {
    const page: PagedResult<T> = await metaRequest(nextPath);
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

export type Campaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  created_time: string;
  updated_time: string;
};

export async function getCampaigns(adAccountId: string): Promise<Campaign[]> {
  const accountPath = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const fields = "id,name,objective,status,effective_status,created_time,updated_time";
  return fetchPaged<Campaign>(`${accountPath}/campaigns?fields=${fields}&limit=100`);
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
};

export async function getAdSets(campaignId: string): Promise<AdSet[]> {
  const fields =
    "id,campaign_id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,targeting";
  return fetchPaged<AdSet>(`${campaignId}/adsets?fields=${fields}&limit=100`);
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
};

export async function getAds(adSetId: string): Promise<Ad[]> {
  const fields =
    "id,name,campaign_id,adset_id,status,effective_status,created_time,updated_time,creative{id,name,thumbnail_url},issues_info,ad_review_feedback";
  return fetchPaged<Ad>(`${adSetId}/ads?fields=${fields}&limit=100`);
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

export async function getMetaUserId(token: string): Promise<string> {
  const data = await metaRequest<{ id: string }>("me?fields=id", { token });
  return data.id;
}
