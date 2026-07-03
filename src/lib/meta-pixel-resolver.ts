import "server-only";

import { graphBaseUrl, metaRequest } from "@/lib/meta";
import {
  classifyMetaError,
  getTokenCapabilityDiagnostics,
  requireMetaConnectionContext,
  type TokenCapabilityDiagnostics,
} from "@/lib/meta-connection-context";
import { normalizeAdAccountId, getNumericAdAccountId } from "@/utils/ad-account";
import type { MetaPixelOption } from "@/types/meta-assets";

const PIXEL_FETCH_LIMIT = 500;

export type PixelResolverStatusCode =
  | "adspixels_success_empty"
  | "adspixels_success"
  | "adspixels_permission_error"
  | "adspixels_token_error"
  | "adspixels_invalid_ad_account"
  | "custom_conversion_pixels_found"
  | "historical_adset_pixels_found"
  | "pixel_found";

export type PixelDiscoveryError = {
  source: string;
  code?: number;
  type?: string;
  message: string;
};

export type PixelResolverDiagnostic = {
  connectionId: string;
  normalizedAdAccountId: string;
  adAccountAccessible: boolean;
  adAccountName?: string;
  adAccountStatus?: number;
  adspixels: {
    requestSucceeded: boolean;
    resultCount: number;
    empty: boolean;
    errorMessage?: string;
  };
  customConversions: {
    requestSucceeded: boolean;
    pixelCount: number;
    errorMessage?: string;
  };
  historicalAdSets: {
    requestSucceeded: boolean;
    pixelCount: number;
    errorMessage?: string;
  };
  pixelRequestSucceeded: boolean;
  resultCount: number;
  directlyVerifiedCount: number;
  metaErrorCode?: number;
  metaErrorType?: string;
  status: PixelResolverStatusCode[];
  errors: PixelDiscoveryError[];
  reason?: string;
};

export type PixelResolverResult = {
  success: boolean;
  pixels: MetaPixelOption[];
  diagnostic: PixelResolverDiagnostic;
  tokenDiagnostics: TokenCapabilityDiagnostics;
};

type RawPixel = { id: string; name?: string; last_fired_time?: string };
type RawCustomConversion = {
  id: string;
  name?: string;
  pixel?: { id?: string; name?: string };
  custom_event_type?: string;
  last_fired_time?: string;
};
type PagedResult<T> = { data?: T[]; paging?: { next?: string } };

type PixelCandidate = {
  id: string;
  name: string;
  lastFiredTime?: string;
  source: "ad_account" | "business" | "custom_conversion" | "historical_adset";
  directlyVerified: boolean;
};

async function fetchPaged<T>(
  initialPath: string,
  token: string,
  connectionId: string,
  max = PIXEL_FETCH_LIMIT,
): Promise<{ items: T[]; error?: PixelDiscoveryError; succeeded: boolean }> {
  const baseUrl = graphBaseUrl();
  let nextPath: string | null = initialPath;
  const results: T[] = [];

  while (nextPath && results.length < max) {
    try {
      const response: PagedResult<T> = await metaRequest<PagedResult<T>>(nextPath, {
        token,
        connectionId,
      });
      if (response.data) results.push(...response.data);
      if (response.paging?.next && results.length < max) {
        nextPath = response.paging.next.replace(`${baseUrl}/`, "");
      } else {
        nextPath = null;
      }
    } catch (error) {
      const classified = classifyMetaError(error);
      return {
        items: results,
        succeeded: false,
        error: {
          source: initialPath.split("?")[0],
          code: classified.code,
          type: classified.type,
          message: classified.message,
        },
      };
    }
  }

  return { items: results.slice(0, max), succeeded: true };
}

function isPermissionError(error: PixelDiscoveryError): boolean {
  const msg = error.message.toLowerCase();
  return msg.includes("permission") || error.code === 10 || error.code === 200;
}

function isTokenError(error: PixelDiscoveryError): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("invalid oauth") ||
    msg.includes("expired") ||
    error.code === 190 ||
    error.code === 102
  );
}

function mergePixel(
  map: Map<string, PixelCandidate>,
  pixel: PixelCandidate,
): void {
  const existing = map.get(pixel.id);
  if (!existing) {
    map.set(pixel.id, pixel);
    return;
  }
  map.set(pixel.id, {
    ...existing,
    name: existing.name.startsWith("Pixel ") && !pixel.name.startsWith("Pixel ") ? pixel.name : existing.name,
    lastFiredTime: existing.lastFiredTime ?? pixel.lastFiredTime,
    directlyVerified: existing.directlyVerified || pixel.directlyVerified,
    source: existing.directlyVerified ? existing.source : pixel.source,
  });
}

function buildPixelReason(input: {
  status: PixelResolverStatusCode[];
  diagnostic: PixelResolverDiagnostic;
}): string {
  const { status, diagnostic } = input;
  if (status.includes("adspixels_token_error")) return "Token gecersiz veya suresi dolmus";
  if (status.includes("adspixels_permission_error")) return "Pixel sorgusu permission hatasi verdi";
  if (status.includes("adspixels_invalid_ad_account")) return "Gecersiz veya erisilemeyen reklam hesabi ID";
  if (status.includes("adspixels_success_empty") && diagnostic.resultCount === 0) {
    return "Pixel sorgusu basarili; bu reklam hesabinda Pixel bulunamadi (data: [])";
  }
  if (status.includes("historical_adset_pixels_found") && diagnostic.directlyVerifiedCount === 0) {
    return "Pixel gecmis reklam setinde bulundu ancak dogrudan kullanilabilirligi dogrulanamadi";
  }
  if (diagnostic.resultCount > 0) return `${diagnostic.resultCount} Pixel bulundu`;
  return "Pixel bulunamadi";
}

export async function resolveAdAccountPixels(input: {
  connectionId: string;
  adAccountId: string;
}): Promise<PixelResolverResult> {
  const ctx = await requireMetaConnectionContext({
    connectionId: input.connectionId,
    adAccountId: input.adAccountId,
  });
  const tokenDiagnostics = await getTokenCapabilityDiagnostics(ctx);

  const rawId = input.adAccountId.trim();
  const normalizedAdAccountId = normalizeAdAccountId(rawId);
  const errors: PixelDiscoveryError[] = [];
  const status: PixelResolverStatusCode[] = [];
  const byId = new Map<string, PixelCandidate>();

  const diagnostic: PixelResolverDiagnostic = {
    connectionId: ctx.connectionId,
    normalizedAdAccountId,
    adAccountAccessible: false,
    adspixels: { requestSucceeded: false, resultCount: 0, empty: true },
    customConversions: { requestSucceeded: false, pixelCount: 0 },
    historicalAdSets: { requestSucceeded: false, pixelCount: 0 },
    pixelRequestSucceeded: false,
    resultCount: 0,
    directlyVerifiedCount: 0,
    status,
    errors,
  };

  if (!normalizedAdAccountId) {
    status.push("adspixels_invalid_ad_account");
    diagnostic.reason = "Gecersiz reklam hesabi ID formatı";
    return { success: false, pixels: [], diagnostic, tokenDiagnostics };
  }

  if (getNumericAdAccountId(rawId) === ctx.metaBusinessId) {
    status.push("adspixels_invalid_ad_account");
    diagnostic.reason = "Business ID reklam hesabi olarak kullanilamaz";
    return { success: false, pixels: [], diagnostic, tokenDiagnostics };
  }

  try {
    const account = await metaRequest<{
      id: string;
      account_id?: string;
      name?: string;
      account_status?: number;
    }>(`${normalizedAdAccountId}?fields=id,account_id,name,account_status`, {
      token: ctx.accessToken,
      connectionId: ctx.connectionId,
    });
    diagnostic.adAccountAccessible = true;
    diagnostic.adAccountName = account.name;
    diagnostic.adAccountStatus = account.account_status;
  } catch (error) {
    const classified = classifyMetaError(error);
    errors.push({
      source: "ad_account",
      code: classified.code,
      type: classified.type,
      message: classified.message,
    });
    status.push("adspixels_invalid_ad_account");
    diagnostic.metaErrorCode = classified.code;
    diagnostic.reason = `Reklam hesabi dogrulanamadi: ${classified.message}`;
    return { success: false, pixels: [], diagnostic, tokenDiagnostics };
  }

  const adspixelsFetch = await fetchPaged<RawPixel>(
    `${normalizedAdAccountId}/adspixels?fields=id,name,last_fired_time&limit=100`,
    ctx.accessToken,
    ctx.connectionId,
  );

  if (adspixelsFetch.error) {
    errors.push({ ...adspixelsFetch.error, source: "adspixels" });
    diagnostic.adspixels.errorMessage = adspixelsFetch.error.message;
    diagnostic.metaErrorCode = adspixelsFetch.error.code;
    diagnostic.metaErrorType = adspixelsFetch.error.type;
    if (isPermissionError(adspixelsFetch.error)) status.push("adspixels_permission_error");
    else if (isTokenError(adspixelsFetch.error)) status.push("adspixels_token_error");
  } else {
    diagnostic.adspixels.requestSucceeded = true;
    diagnostic.pixelRequestSucceeded = true;
    diagnostic.adspixels.resultCount = adspixelsFetch.items.length;
    diagnostic.adspixels.empty = adspixelsFetch.items.length === 0;

    if (adspixelsFetch.items.length === 0) {
      status.push("adspixels_success_empty");
    } else {
      status.push("adspixels_success");
      status.push("pixel_found");
    }

    for (const pixel of adspixelsFetch.items) {
      if (!pixel.id) continue;
      mergePixel(byId, {
        id: pixel.id,
        name: pixel.name?.trim() || `Pixel ${pixel.id}`,
        lastFiredTime: pixel.last_fired_time,
        source: "ad_account",
        directlyVerified: true,
      });
    }
  }

  const shouldTryFallbacks = byId.size === 0;

  if (shouldTryFallbacks) {
    const ccFetch = await fetchPaged<RawCustomConversion>(
      `${normalizedAdAccountId}/customconversions?fields=id,name,pixel,custom_event_type,data_sources,last_fired_time&limit=100`,
      ctx.accessToken,
      ctx.connectionId,
    );

    if (ccFetch.error) {
      errors.push({ ...ccFetch.error, source: "customconversions" });
      diagnostic.customConversions.errorMessage = ccFetch.error.message;
    } else {
      diagnostic.customConversions.requestSucceeded = true;
      let ccPixelCount = 0;
      for (const row of ccFetch.items) {
        const pixelId = row.pixel?.id;
        if (!pixelId) continue;
        ccPixelCount += 1;
        mergePixel(byId, {
          id: pixelId,
          name: row.pixel?.name?.trim() || row.name?.trim() || `Pixel ${pixelId}`,
          lastFiredTime: row.last_fired_time,
          source: "custom_conversion",
          directlyVerified: false,
        });
      }
      diagnostic.customConversions.pixelCount = ccPixelCount;
      if (ccPixelCount > 0) status.push("custom_conversion_pixels_found");
    }

    const adsetFetch = await fetchPaged<{ promoted_object?: { pixel_id?: string; pixel_rule?: string } }>(
      `${normalizedAdAccountId}/adsets?fields=promoted_object&limit=100`,
      ctx.accessToken,
      ctx.connectionId,
    );

    if (adsetFetch.error) {
      errors.push({ ...adsetFetch.error, source: "adsets_promoted_object" });
      diagnostic.historicalAdSets.errorMessage = adsetFetch.error.message;
    } else {
      diagnostic.historicalAdSets.requestSucceeded = true;
      let histCount = 0;
      for (const adset of adsetFetch.items) {
        const pixelId = adset.promoted_object?.pixel_id;
        if (!pixelId) continue;
        histCount += 1;
        mergePixel(byId, {
          id: String(pixelId),
          name: `Pixel ${pixelId}`,
          source: "historical_adset",
          directlyVerified: false,
        });
      }
      diagnostic.historicalAdSets.pixelCount = histCount;
      if (histCount > 0) status.push("historical_adset_pixels_found");
    }
  }

  diagnostic.resultCount = byId.size;
  diagnostic.directlyVerifiedCount = Array.from(byId.values()).filter((p) => p.directlyVerified).length;
  diagnostic.reason = buildPixelReason({ status, diagnostic });

  const pixels: MetaPixelOption[] = Array.from(byId.values()).map((pixel) => ({
    id: pixel.id,
    name: pixel.name,
    lastFiredTime: pixel.lastFiredTime,
    source: pixel.source === "custom_conversion" || pixel.source === "historical_adset" ? "ad_account" : pixel.source,
    available: pixel.directlyVerified,
  }));

  return {
    success: diagnostic.adspixels.requestSucceeded || diagnostic.customConversions.requestSucceeded || diagnostic.historicalAdSets.requestSucceeded,
    pixels,
    diagnostic,
    tokenDiagnostics,
  };
}
