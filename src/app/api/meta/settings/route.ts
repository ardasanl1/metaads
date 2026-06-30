import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { getPublicMetaConfig, hasMetaConfig, saveMetaConfig } from "@/lib/meta";

type MetaSettingsPayload = {
  appId?: string;
  appSecret?: string;
  redirectUri?: string;
  apiVersion?: string;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidApiVersion(value: string): boolean {
  return /^v\d+\.\d+$/.test(value);
}

function buildDefaultRedirectUri(request: NextRequest): string {
  return `${request.nextUrl.origin}/api/meta/callback`;
}

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const config = await getPublicMetaConfig();

    return NextResponse.json({
      configured: Boolean(config),
      appId: config?.appId ?? "",
      hasAppSecret: config?.hasAppSecret ?? false,
      redirectUri: config?.redirectUri ?? buildDefaultRedirectUri(request),
      apiVersion: config?.apiVersion ?? "v23.0",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as MetaSettingsPayload;
    const appId = normalizeString(body.appId);
    const appSecret = normalizeString(body.appSecret);
    const redirectUri = normalizeString(body.redirectUri);
    const apiVersion = normalizeString(body.apiVersion);
    if (!appId) {
      return jsonError("Meta App ID gerekli", 400);
    }

    if (!redirectUri) {
      return jsonError("Redirect URI gerekli", 400);
    }

    try {
      new URL(redirectUri);
    } catch {
      return jsonError("Redirect URI gecerli bir URL olmali", 400);
    }

    if (!apiVersion) {
      return jsonError("API Version gerekli", 400);
    }

    if (!isValidApiVersion(apiVersion)) {
      return jsonError("API Version v23.0 formatinda olmali", 400);
    }

    if (!appSecret && !(await hasMetaConfig())) {
      return jsonError("Ilk kayitta Meta App Secret gerekli", 400);
    }

    const savedConfig = await saveMetaConfig({
      appId,
      appSecret: appSecret || undefined,
      redirectUri,
      apiVersion,
    });

    return NextResponse.json({
      configured: true,
      ...savedConfig,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
