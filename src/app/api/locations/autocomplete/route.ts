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
    return jsonError("Google Places yapılandırması eksik (GOOGLE_MAPS_API_KEY)", 500);
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

