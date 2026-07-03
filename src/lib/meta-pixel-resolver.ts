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

export type PixelResolverDiagnostic = {
  normalizedAdAccountId: string;
  adAccountAccessible: boolean;
  adAccountName?: string;
  adAccountStatus?: number;
  pixelRequestSucceeded: boolean;
  resultCount: number;
  metaErrorCode?: number;
  metaErrorType?: string;
  reason?: string;
};

export type PixelResolverResult = {
  success: boolean;
  pixels: MetaPixelOption[];
  diagnostic: PixelResolverDiagnostic;
  tokenDiagnostics: TokenCapabilityDiagnostics;
};

type RawPixel = { id: string; name?: string; last_fired_time?: string };
type PagedResult<T> = { data?: T[]; paging?: { next?: string } };

async function fetchAdPixels(
  accountPath: string,
  token: string,
  connectionId: string,
): Promise<{ pixels: RawPixel[]; error?: ReturnType<typeof classifyMetaError> }> {
  const baseUrl = graphBaseUrl();
  let nextPath: string | null = `${accountPath}/adspixels?fields=id,name,last_fired_time&limit=200`;
  const results: RawPixel[] = [];

  while (nextPath && results.length < PIXEL_FETCH_LIMIT) {
    try {
      const response: PagedResult<RawPixel> = await metaRequest<PagedResult<RawPixel>>(nextPath, { token, connectionId });
      if (response.data) results.push(...response.data);
      if (response.paging?.next && results.length < PIXEL_FETCH_LIMIT) {
        nextPath = response.paging.next.replace(`${baseUrl}/`, "");
      } else {
        nextPath = null;
      }
    } catch (error) {
      return { pixels: results, error: classifyMetaError(error) };
    }
  }

  return { pixels: results.slice(0, PIXEL_FETCH_LIMIT) };
}

function buildPixelEmptyReason(input: {
  diagnostic: PixelResolverDiagnostic;
  tokenDiagnostics: TokenCapabilityDiagnostics;
  pixelError?: ReturnType<typeof classifyMetaError>;
}): string {
  const { diagnostic, tokenDiagnostics, pixelError } = input;

  if (!diagnostic.normalizedAdAccountId) {
    return "Geçersiz reklam hesabı ID formatı";
  }
  if (!diagnostic.adAccountAccessible) {
    return "Reklam hesabına erişilemiyor";
  }
  if (!tokenDiagnostics.grantedPermissions.includes("ads_read")) {
    return "ads_read izni eksik";
  }
  if (pixelError) {
    if (pixelError.message.includes("OAuth") || pixelError.code === 190) {
      return "Token geçersiz veya süresi dolmuş";
    }
    if (pixelError.message.toLowerCase().includes("permission") || pixelError.code === 10) {
      return `İzin hatası: ${pixelError.message}`;
    }
    return `Meta API hatası: ${pixelError.message}`;
  }
  if (diagnostic.pixelRequestSucceeded && diagnostic.resultCount === 0) {
    return "Pixel sorgusu başarılı; bu reklam hesabında Pixel bulunamadı (data: [])";
  }
  return "Pixel bulunamadı";
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

  const diagnostic: PixelResolverDiagnostic = {
    normalizedAdAccountId,
    adAccountAccessible: false,
    pixelRequestSucceeded: false,
    resultCount: 0,
  };

  if (!normalizedAdAccountId) {
    diagnostic.reason = "Geçersiz reklam hesabı ID";
    return { success: false, pixels: [], diagnostic, tokenDiagnostics };
  }

  if (getNumericAdAccountId(rawId) === ctx.metaBusinessId) {
    diagnostic.reason = "Business ID reklam hesabı olarak kullanılamaz";
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
    diagnostic.metaErrorCode = classified.code;
    diagnostic.reason = `Reklam hesabı doğrulanamadı: ${classified.message}`;
    return { success: false, pixels: [], diagnostic, tokenDiagnostics };
  }

  const pixelFetch = await fetchAdPixels(normalizedAdAccountId, ctx.accessToken, ctx.connectionId);

  if (pixelFetch.error) {
    diagnostic.metaErrorCode = pixelFetch.error.code;
    diagnostic.metaErrorType = pixelFetch.error.type;
    diagnostic.reason = buildPixelEmptyReason({
      diagnostic,
      tokenDiagnostics,
      pixelError: pixelFetch.error,
    });
    return { success: false, pixels: [], diagnostic, tokenDiagnostics };
  }

  diagnostic.pixelRequestSucceeded = true;
  diagnostic.resultCount = pixelFetch.pixels.length;

  const pixels: MetaPixelOption[] = pixelFetch.pixels.map((pixel) => ({
    id: pixel.id,
    name: pixel.name?.trim() || `Pixel ${pixel.id}`,
    lastFiredTime: pixel.last_fired_time,
    source: "ad_account" as const,
    available: true,
  }));

  if (pixels.length === 0) {
    diagnostic.reason = buildPixelEmptyReason({ diagnostic, tokenDiagnostics });
  }

  return {
    success: diagnostic.pixelRequestSucceeded,
    pixels,
    diagnostic,
    tokenDiagnostics,
  };
}
