import type { CampaignSubmit } from "@/types/campaign-wizard";
import { buildGeoLocationsFromAudience, buildTargetingFromAudience } from "@/utils/wizard-location";

export function buildTargetingFromSubmit(draft: CampaignSubmit): Record<string, unknown> {
  const locations = draft.audienceLocations ?? [];
  const locationFromAssets = draft.selectedAssets.location;
  const resolvedLocations =
    locations.length > 0
      ? locations
      : locationFromAssets?.key
        ? [
            {
              key: locationFromAssets.key,
              name: locationFromAssets.displayName,
              type: locationFromAssets.type,
              countryCode: locationFromAssets.countryCode,
              displayName: locationFromAssets.displayName,
            },
          ]
        : [];

  return buildTargetingFromAudience({
    locations: resolvedLocations,
    ageMin: draft.ageMin,
    ageMax: draft.ageMax,
    genders: [draft.gender ?? "ALL"],
  });
}

export function buildGeoFromDraft(draft: CampaignSubmit): Record<string, unknown> {
  const locations = draft.audienceLocations ?? [];
  if (locations.length > 0) {
    return buildGeoLocationsFromAudience(locations);
  }
  const location = draft.selectedAssets.location;
  if (!location?.key) return { countries: ["TR"], location_types: ["home", "recent"] };
  return buildGeoLocationsFromAudience([
    {
      key: location.key,
      name: location.displayName,
      type: location.type,
      countryCode: location.countryCode,
      displayName: location.displayName,
    },
  ]);
}
