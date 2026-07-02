import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";

type GoogleAutocompleteSuggestion = {
  placeId: string;
  displayName: string;
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  const countryCode = request.nextUrl.searchParams.get("countryCode")?.trim() ?? "";
  const sessionToken = request.nextUrl.searchParams.get("sessionToken")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] satisfies GoogleAutocompleteSuggestion[] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    // Ücretsiz fallback: OpenStreetMap Nominatim (rate limit/policy geçerli)
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "10");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "tr");
    if (countryCode) url.searchParams.set("countrycodes", countryCode.toLowerCase());

    const resp = await fetch(url.toString(), {
      headers: {
        // Nominatim policy: identify your app
        "User-Agent": "meta-ads-panel/0.1 (location autocomplete)",
      },
    });
    const raw = (await resp.json()) as unknown;
    if (!resp.ok) return jsonError("Konum araması başarısız", 502);

    const list = Array.isArray(raw) ? raw : [];
    const suggestions: GoogleAutocompleteSuggestion[] = list
      .map((x) => x as { place_id?: unknown; display_name?: unknown })
      .map((x) => ({
        placeId: `nominatim:${String(x.place_id ?? "").trim()}`,
        displayName: String(x.display_name ?? "").trim(),
      }))
      .filter((s) => s.placeId !== "nominatim:" && s.displayName);

    return NextResponse.json({ suggestions });
  }

  const body: Record<string, unknown> = {
    input: query,
    sessionToken: sessionToken || undefined,
    // Reklam hedeflemesinde işe yarayan konumlar: locality/administrative/country
    includedPrimaryTypes: ["locality", "administrative_area_level_1", "country"],
    languageCode: "tr",
  };
  if (countryCode) {
    body.includedRegionCodes = [countryCode.toUpperCase()];
  }

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    },
    body: JSON.stringify(body),
  });

  const raw = (await response.json()) as unknown;
  if (!response.ok) {
    return jsonError("Google Places isteği başarısız", 502);
  }

  const suggestionsRaw = (raw as { suggestions?: unknown[] } | null)?.suggestions;
  const suggestions: GoogleAutocompleteSuggestion[] = Array.isArray(suggestionsRaw)
    ? suggestionsRaw
        .map((s) => (s as { placePrediction?: unknown } | null)?.placePrediction)
        .filter(Boolean)
        .map((p) => {
          const pred = p as { placeId?: unknown; text?: { text?: unknown } };
          return {
            placeId: String(pred.placeId ?? "").trim(),
            displayName: String(pred.text?.text ?? "").trim(),
          };
        })
        .filter((x: GoogleAutocompleteSuggestion) => x.placeId && x.displayName)
    : [];

  return NextResponse.json({ suggestions });
}

