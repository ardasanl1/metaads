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
    // Ücretsiz fallback: Nominatim details
    if (!placeId.startsWith("nominatim:")) {
      return jsonError("Konum detayları alınamadı (provider yok)", 400);
    }
    const nominatimPlaceId = placeId.replace(/^nominatim:/, "").trim();
    if (!nominatimPlaceId) return jsonError("placeId geçersiz", 400);

    const url = new URL("https://nominatim.openstreetmap.org/details");
    url.searchParams.set("place_id", nominatimPlaceId);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "tr");

    const resp = await fetch(url.toString(), {
      headers: { "User-Agent": "meta-ads-panel/0.1 (location details)" },
    });
    const raw = (await resp.json()) as unknown;
    if (!resp.ok) return jsonError("Konum detayları alınamadı", 502);

    const obj = raw as {
      place_id?: unknown;
      country_code?: unknown;
      localname?: unknown;
      display_name?: unknown;
      address?: Record<string, string>;
      centroid?: { coordinates?: [number, number] };
    };

    const address = obj.address ?? {};
    const countryCode = String(obj.country_code ?? address.country_code ?? "").toUpperCase();
    const selection: GoogleLocationSelection = {
      placeId,
      displayName: String(obj.display_name ?? obj.localname ?? "").trim() || placeId,
      countryCode,
      countryName: address.country ?? undefined,
      regionName: address.state ?? address.region ?? undefined,
      cityName: address.city ?? address.town ?? address.village ?? undefined,
      latitude: obj.centroid?.coordinates?.[1],
      longitude: obj.centroid?.coordinates?.[0],
    };

    if (!selection.countryCode) {
      return jsonError("Seçilen konumdan ülke bilgisi alınamadı", 400);
    }

    return NextResponse.json({ selection });
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

