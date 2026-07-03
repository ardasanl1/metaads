import type { SelectedMetaLocation } from "@/types/campaign-questionnaire";
import type { MetaLocationOption } from "@/types/meta-assets";

export function metaLocationToSelected(loc: MetaLocationOption): SelectedMetaLocation {
  return {
    key: loc.key,
    name: loc.name,
    type: loc.type,
    countryCode: loc.countryCode,
    countryName: loc.countryName,
    regionName: loc.regionName,
    displayName: loc.displayName,
  };
}

export function selectedToMetaLocationOption(
  loc: SelectedMetaLocation,
): MetaLocationOption {
  return {
    key: loc.key,
    name: loc.name ?? loc.displayName,
    type: loc.type,
    countryCode: loc.countryCode,
    countryName: loc.countryName,
    regionName: loc.regionName,
    displayName: loc.displayName,
  };
}

export function formatTargetLocations(locations: SelectedMetaLocation[]): string {
  if (locations.length === 0) return "—";
  return locations.map((loc) => loc.displayName).join(", ");
}

export function buildGeoLocationsFromAudience(
  locations: SelectedMetaLocation[],
): Record<string, unknown> {
  if (locations.length === 0) {
    return { countries: ["TR"] };
  }

  const countries = new Set<string>();
  const cities: Array<{ key: string }> = [];
  const regions: Array<{ key: string }> = [];
  const zips: Array<{ key: string }> = [];

  for (const location of locations) {
    if (location.type === "city") {
      cities.push({ key: location.key });
    } else if (location.type === "region") {
      regions.push({ key: location.key });
    } else if (location.type === "zip") {
      zips.push({ key: location.key });
    } else {
      countries.add(location.countryCode.toUpperCase());
    }
  }

  const geo: Record<string, unknown> = {};
  if (countries.size > 0) geo.countries = Array.from(countries);
  if (cities.length > 0) geo.cities = cities;
  if (regions.length > 0) geo.regions = regions;
  if (zips.length > 0) geo.zips = zips;

  if (Object.keys(geo).length === 0) {
    return { countries: ["TR"], location_types: ["home", "recent"] };
  }

  if (geo.cities || geo.regions || geo.zips) {
    geo.location_types = ["home", "recent"];
  }

  return geo;
}

export function buildTargetingFromAudience(input: {
  locations: SelectedMetaLocation[];
  ageMin: number;
  ageMax: number;
  genders: string[];
}): Record<string, unknown> {
  const targeting: Record<string, unknown> = {
    age_min: input.ageMin,
    age_max: input.ageMax,
    geo_locations: buildGeoLocationsFromAudience(input.locations),
  };

  const genders = input.genders.filter((g) => g !== "ALL");
  if (genders.length === 1) {
    targeting.genders = genders[0] === "MALE" ? [1] : [2];
  }

  return targeting;
}
