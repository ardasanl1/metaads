import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { getApiVersion } from "@/lib/meta";

export const META_OAUTH_SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
] as const;

const STATE_TTL_MS = 10 * 60 * 1000;

type OAuthStatePayload = {
  nonce: string;
  exp: number;
  reauthorize?: boolean;
};

function getOAuthConfig() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_REDIRECT_URI?.trim();
  if (!appId || !appSecret || !redirectUri) {
    throw new Error("META_APP_ID, META_APP_SECRET ve META_REDIRECT_URI tanimli olmali");
  }
  return { appId, appSecret, redirectUri, apiVersion: getApiVersion() };
}

function stateSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) throw new Error("SESSION_SECRET tanimli degil");
  return secret;
}

function signPayload(encoded: string): string {
  return createHmac("sha256", stateSecret()).update(encoded).digest("base64url");
}

export function createOAuthState(options?: { reauthorize?: boolean }): string {
  const payload: OAuthStatePayload = {
    nonce: randomUUID(),
    exp: Date.now() + STATE_TTL_MS,
    reauthorize: options?.reauthorize,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signPayload(encoded)}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) throw new Error("Gecersiz OAuth state");
  const expected = signPayload(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("OAuth state imzasi gecersiz");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
  if (!payload.exp || Date.now() > payload.exp) {
    throw new Error("OAuth state suresi dolmus");
  }
  return payload;
}

export function buildMetaOAuthUrl(options?: { reauthorize?: boolean }): string {
  const { appId, redirectUri, apiVersion } = getOAuthConfig();
  const state = createOAuthState(options);
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: META_OAUTH_SCOPES.join(","),
    response_type: "code",
  });
  if (options?.reauthorize) {
    params.set("auth_type", "rerequest");
  }
  return `https://www.facebook.com/${apiVersion}/dialog/oauth?${params.toString()}`;
}

export async function exchangeOAuthCode(code: string): Promise<{
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
}> {
  const { appId, appSecret, redirectUri, apiVersion } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const url = `https://graph.facebook.com/${apiVersion}/oauth/access_token?${params.toString()}`;
  const response = await fetch(url);
  const data = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error?.message ?? "OAuth token degisimi basarisiz");
  }
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
  };
}

export async function exchangeLongLivedUserToken(shortLivedToken: string): Promise<{
  accessToken: string;
  expiresIn?: number;
}> {
  const { appId, appSecret, apiVersion } = getOAuthConfig();
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  const url = `https://graph.facebook.com/${apiVersion}/oauth/access_token?${params.toString()}`;
  const response = await fetch(url);
  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error?.message ?? "Uzun omurlu token alinamadi");
  }
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function debugMetaToken(inputToken: string): Promise<{
  userId?: string;
  appId?: string;
  type?: string;
  isValid: boolean;
  scopes?: string[];
  granularScopes?: Array<{ scope: string; target_ids?: string[] }>;
  expiresAt?: number;
  error?: string;
}> {
  const { appId, appSecret, apiVersion } = getOAuthConfig();
  const appToken = `${appId}|${appSecret}`;
  const params = new URLSearchParams({
    input_token: inputToken,
    access_token: appToken,
  });
  const url = `https://graph.facebook.com/${apiVersion}/debug_token?${params.toString()}`;
  const response = await fetch(url);
  const data = (await response.json()) as {
    data?: {
      app_id?: string;
      user_id?: string;
      type?: string;
      is_valid?: boolean;
      scopes?: string[];
      granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
      expires_at?: number;
      error?: { message?: string };
    };
    error?: { message?: string };
  };
  if (!response.ok) {
    return { isValid: false, error: data.error?.message ?? "debug_token basarisiz" };
  }
  const row = data.data;
  return {
    userId: row?.user_id,
    appId: row?.app_id,
    type: row?.type,
    isValid: Boolean(row?.is_valid),
    scopes: row?.scopes ?? [],
    granularScopes: row?.granular_scopes ?? [],
    expiresAt: row?.expires_at,
    error: row?.error?.message,
  };
}

export function isOAuthConfigured(): boolean {
  return Boolean(
    process.env.META_APP_ID?.trim() &&
      process.env.META_APP_SECRET?.trim() &&
      process.env.META_REDIRECT_URI?.trim(),
  );
}
