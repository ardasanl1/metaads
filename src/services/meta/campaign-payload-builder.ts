import { WEBSITE_SALES_RECIPE } from "@/config/campaign-recipes";
import type { WebsiteSalesDraft, WebsiteSalesSubmit } from "@/types/campaign-wizard";
import type { SelectedMetaAssets } from "@/types/meta-assets";

export type BuildCampaignPayloadResult = {
  name: string;
  objective: "OUTCOME_SALES";
  buyingType: "AUCTION";
  specialAdCategories: string[];
  status: "PAUSED";
};

export type BuildAdSetPayloadResult = {
  name: string;
  campaignId: string;
  dailyBudget: number;
  status: "PAUSED";
  billingEvent: "IMPRESSIONS";
  optimizationGoal: "OFFSITE_CONVERSIONS";
  targeting: unknown;
  promotedObject: unknown;
  startTime?: string;
  endTime?: string;
};

export type BuildCreativePayloadResult = {
  name: string;
  pageId: string;
  instagramActorId?: string;
  websiteUrl: string;
  imageHash: string;
  primaryText: string;
  headline: string;
  description?: string;
  ctaType: "SHOP_NOW" | "LEARN_MORE" | "SIGN_UP" | "GET_OFFER";
};

export type BuildAdPayloadResult = {
  name: string;
  adSetId: string;
  creativeId: string;
  status: "PAUSED";
};

function buildGeoFromSelectedAssets(assets: SelectedMetaAssets): Record<string, unknown> | null {
  const location = assets.location;
  if (!location?.key) return null;

  if (location.type === "city") {
    return { cities: [{ key: location.key }] };
  }
  if (location.type === "region") {
    return { regions: [{ key: location.key }] };
  }
  if (location.type === "zip") {
    return { zips: [{ key: location.key }] };
  }
  if (location.type === "country") {
    return { countries: [location.countryCode.toUpperCase()] };
  }
  return null;
}

export function buildTargetingFromDraft(draft: WebsiteSalesDraft): unknown {
  const genders =
    draft.gender === "ALL" ? undefined : draft.gender === "MALE" ? [1] : [2];

  const targeting: Record<string, unknown> = {
    age_min: draft.ageMin,
    age_max: draft.ageMax,
  };

  if (genders) targeting.genders = genders;

  const geo = buildGeoFromSelectedAssets(draft.selectedAssets);
  if (geo) {
    targeting.geo_locations = geo;
  } else if (draft.metaCity?.key) {
    targeting.geo_locations = { cities: [{ key: draft.metaCity.key }] };
  } else if (draft.metaRegion?.key) {
    targeting.geo_locations = { regions: [{ key: draft.metaRegion.key }] };
  } else {
    targeting.geo_locations = {
      countries: [
        draft.selectedAssets.location?.countryCode?.toUpperCase() ??
          draft.metaCountryCode ??
          draft.country?.countryCode?.toUpperCase() ??
          "TR",
      ],
    };
  }
  return targeting;
}

export function buildTargetingFromSubmit(draft: WebsiteSalesSubmit): unknown {
  const genders =
    draft.gender === "ALL" ? undefined : draft.gender === "MALE" ? [1] : [2];

  const targeting: Record<string, unknown> = {
    age_min: draft.ageMin,
    age_max: draft.ageMax,
  };

  if (genders) targeting.genders = genders;

  const geo = buildGeoFromSelectedAssets(draft.selectedAssets);
  if (geo) {
    targeting.geo_locations = geo;
  } else if (draft.metaCity?.key) {
    targeting.geo_locations = { cities: [{ key: draft.metaCity.key }] };
  } else if (draft.metaRegion?.key) {
    targeting.geo_locations = { regions: [{ key: draft.metaRegion.key }] };
  } else {
    targeting.geo_locations = {
      countries: [
        draft.selectedAssets.location?.countryCode?.toUpperCase() ??
          draft.metaCountryCode ??
          draft.country?.countryCode?.toUpperCase() ??
          "TR",
      ],
    };
  }
  return targeting;
}

export function buildCampaignPayload(draft: WebsiteSalesSubmit): BuildCampaignPayloadResult {
  const categories = draft.specialAdCategory === "NONE" ? [] : [draft.specialAdCategory];
  return {
    name: draft.campaignName.trim(),
    objective: WEBSITE_SALES_RECIPE.objective,
    buyingType: WEBSITE_SALES_RECIPE.buyingType,
    specialAdCategories: categories,
    status: "PAUSED",
  };
}

export function buildAdSetPayload(
  draft: WebsiteSalesSubmit,
  campaignId: string,
): BuildAdSetPayloadResult {
  const pixelId = draft.selectedAssets.pixel?.id ?? draft.pixelId;
  const promotedObject = {
    pixel_id: pixelId,
    custom_event_type: WEBSITE_SALES_RECIPE.conversionEvent,
  };

  // Meta start_time ISO bekler: 2026-01-01T00:00:00+0300 gibi. İlk sürümde YYYY-MM-DD -> T00:00:00
  const startTime = draft.startDate ? `${draft.startDate}T00:00:00` : undefined;
  const endTime = draft.endDate ? `${draft.endDate}T00:00:00` : undefined;

  return {
    name: `${draft.campaignName.trim()} - Reklam Seti`,
    campaignId,
    dailyBudget: draft.dailyBudget,
    status: "PAUSED",
    billingEvent: WEBSITE_SALES_RECIPE.billingEvent,
    optimizationGoal: WEBSITE_SALES_RECIPE.optimizationGoal,
    targeting: buildTargetingFromSubmit(draft),
    promotedObject,
    startTime,
    endTime,
  };
}

export function buildCreativePayload(
  draft: WebsiteSalesSubmit,
): BuildCreativePayloadResult {
  const pageId = draft.selectedAssets.page?.id ?? draft.pageId;
  const instagramActorId =
    (draft.selectedAssets.instagram?.id ?? draft.instagramActorId?.trim()) || undefined;
  return {
    name: `${draft.campaignName.trim()} - Creative`,
    pageId,
    instagramActorId,
    websiteUrl: draft.websiteUrl.trim(),
    imageHash: draft.imageHash,
    primaryText: draft.primaryText.trim(),
    headline: draft.headline.trim(),
    description: draft.description?.trim() || undefined,
    ctaType: draft.cta,
  };
}

export function buildAdPayload(
  draft: WebsiteSalesSubmit,
  adSetId: string,
  creativeId: string,
): BuildAdPayloadResult {
  return {
    name: `${draft.campaignName.trim()} - Reklam`,
    adSetId,
    creativeId,
    status: "PAUSED",
  };
}

