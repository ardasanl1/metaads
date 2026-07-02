import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import type { GoogleLocationSelection } from "@/types/campaign-wizard";

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("placeId")?.trim() ?? "";
  const sessionToken = request.nextUrl.searchParams.get("sessionToken")?.trim() ?? "";
  if (!placeId) return jsonError("placeId gerekli", 400);

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    return jsonError("Google Places yapılandırması eksik (GOOGLE_MAPS_API_KEY)", 500);
  }

  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

  const response = await fetch(url.toString(), {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location",
    },
  });
  const raw = (await response.json()) as unknown;
  if (!response.ok) {
    return jsonError("Google Place details isteği başarısız", 502);
  }

  const addressComponents = (raw as { addressComponents?: unknown } | null)?.addressComponents;
  const comps: AddressComponent[] = Array.isArray(addressComponents)
    ? (addressComponents as AddressComponent[])
    : [];
  const getByType = (type: string) =>
    comps.find((c) => c.types?.includes(type))?.longText?.trim() ||
    comps.find((c) => c.types?.includes(type))?.shortText?.trim();

  const countryCode = getByType("country") ? (comps.find((c) => c.types?.includes("country"))?.shortText ?? "").trim() : "";
  const formattedAddress = (raw as { formattedAddress?: unknown } | null)?.formattedAddress;
  const displayName = (raw as { displayName?: { text?: unknown } } | null)?.displayName?.text;
  const location = (raw as { location?: { latitude?: number; longitude?: number } } | null)?.location;

  const selection: GoogleLocationSelection = {
    placeId,
    displayName: String(formattedAddress ?? displayName ?? "").trim() || placeId,
    countryCode: countryCode || "",
    countryName: getByType("country") || undefined,
    regionName: getByType("administrative_area_level_1") || undefined,
    cityName: getByType("locality") || getByType("administrative_area_level_2") || undefined,
    latitude: location?.latitude,
    longitude: location?.longitude,
  };

  if (!selection.countryCode) {
    return jsonError("Seçilen konumdan ülke bilgisi alınamadı", 400);
  }

  return NextResponse.json({ selection });
}

