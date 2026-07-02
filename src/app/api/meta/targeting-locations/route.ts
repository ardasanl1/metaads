import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { resolveMetaGeoLocation, searchTargetingLocations } from "@/lib/meta";
import type { MetaTargetingLocationType } from "@/lib/meta";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
    const countryCode = request.nextUrl.searchParams.get("countryCode")?.trim() ?? "";
    const locationType = request.nextUrl.searchParams.get("locationType")?.trim() ?? "";
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim() ?? undefined;
    const resolve = request.nextUrl.searchParams.get("resolve") === "1";
    const cityName = request.nextUrl.searchParams.get("cityName")?.trim() ?? "";
    const regionName = request.nextUrl.searchParams.get("regionName")?.trim() ?? "";
    const displayName = request.nextUrl.searchParams.get("displayName")?.trim() ?? "";
    const adAccountId = request.nextUrl.searchParams.get("adAccountId")?.trim() ?? undefined;

    if (resolve) {
      if (!countryCode) return jsonError("countryCode gerekli", 400);
      const resolved = await resolveMetaGeoLocation({
        cityName: cityName || query || undefined,
        regionName: regionName || undefined,
        displayName: displayName || undefined,
        countryCode,
        connectionId,
        adAccountId,
      });

      const match = resolved.city ?? resolved.region ?? null;
      return NextResponse.json({
        city: resolved.city
          ? {
              key: resolved.city.key,
              name: resolved.city.name,
              type: resolved.city.type,
              countryCode: resolved.city.country_code,
              countryName: resolved.city.country_name,
              region: resolved.city.region,
              regionId: resolved.city.region_id,
              supportsRadius: Boolean(resolved.city.supports_radius),
            }
          : null,
        region: resolved.region
          ? {
              key: resolved.region.key,
              name: resolved.region.name,
              type: resolved.region.type,
              countryCode: resolved.region.country_code,
              countryName: resolved.region.country_name,
              region: resolved.region.region,
              regionId: resolved.region.region_id,
              supportsRadius: Boolean(resolved.region.supports_radius),
            }
          : null,
        match: match
          ? {
              key: match.key,
              name: match.name,
              type: match.type,
              countryCode: match.country_code,
              countryName: match.country_name,
              region: match.region,
              regionId: match.region_id,
              supportsRadius: Boolean(match.supports_radius),
            }
          : null,
        error: resolved.error ?? null,
      });
    }

    if (!query) return jsonError("query gerekli", 400);
    if (
      locationType &&
      locationType !== "country" &&
      locationType !== "region" &&
      locationType !== "city"
    ) {
      return jsonError("locationType country|region|city olmalı", 400);
    }

    const items = await searchTargetingLocations({
      query,
      countryCode: countryCode || undefined,
      locationType: locationType
        ? (locationType as MetaTargetingLocationType)
        : undefined,
      connectionId,
    });

    const locations = items.map((x) => ({
      key: x.key,
      name: x.name,
      type: x.type ?? locationType,
      countryCode: x.country_code,
      countryName: x.country_name,
      region: x.region,
      regionId: x.region_id,
      supportsRadius: Boolean(x.supports_radius),
    }));

    return NextResponse.json({ locations });
  } catch (error) {
    return handleApiError(error);
  }
}

