import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { searchTargetingLocations } from "@/lib/meta";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
    const countryCode = request.nextUrl.searchParams.get("countryCode")?.trim() ?? "";
    const locationType = request.nextUrl.searchParams.get("locationType")?.trim() ?? "";
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim() ?? undefined;

    if (!query) return jsonError("query gerekli", 400);
    if (locationType !== "country" && locationType !== "region" && locationType !== "city") {
      return jsonError("locationType country|region|city olmalı", 400);
    }

    const items = await searchTargetingLocations({
      query,
      countryCode: countryCode || undefined,
      locationType,
      connectionId,
    });

    const locations = items.map((x) => ({
      key: x.key,
      name: x.name,
      type: locationType,
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

