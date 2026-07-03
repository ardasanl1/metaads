import { getCampaignRecipe, type CampaignRecipeId } from "@/config/campaign-recipes";
import type { CampaignSubmit } from "@/types/campaign-wizard";
import { buildGeoLocationsFromAudience } from "@/utils/wizard-location";
import { recipeRequiresPixel } from "@/utils/recipe-pixel";

function buildGeoFromDraft(draft: CampaignSubmit): Record<string, unknown> {
  const audienceLocations = draft.audienceLocations ?? [];
  if (audienceLocations.length > 0) {
    return buildGeoLocationsFromAudience(audienceLocations);
  }

  const location = draft.selectedAssets.location;
  if (!location?.key) return { countries: ["TR"] };

  if (location.type === "city") return { cities: [{ key: location.key }] };
  if (location.type === "region") return { regions: [{ key: location.key }] };
  if (location.type === "zip") return { zips: [{ key: location.key }] };
  return { countries: [location.countryCode.toUpperCase()] };
}

export function buildTargetingFromSubmit(draft: CampaignSubmit): unknown {
  const genders =
    draft.gender === "ALL" ? undefined : draft.gender === "MALE" ? [1] : [2];

  const targeting: Record<string, unknown> = {
    age_min: draft.ageMin,
    age_max: draft.ageMax,
    geo_locations: buildGeoFromDraft(draft),
  };
  if (genders) targeting.genders = genders;
  return targeting;
}

export function buildPromotedObject(recipeId: CampaignRecipeId, draft: CampaignSubmit): unknown {
  const recipe = getCampaignRecipe(recipeId);
  if (!recipe) throw new Error("Geçersiz recipe");

  const pageId = draft.selectedAssets.page?.id ?? draft.pageId;
  const pixelId = recipeRequiresPixel(draft.recipeId!) ? draft.selectedAssets.pixel?.id ?? draft.pixelId : undefined;
  const formId = draft.selectedAssets.instantForm?.id ?? draft.instantFormId;
  const catalogId = draft.selectedAssets.catalog?.id ?? draft.catalogId;
  const appId = draft.selectedAssets.app?.id ?? draft.appId;

  const promoted: Record<string, string> = {};
  if (recipe.promotedObjectKeys.includes("page_id") && pageId) promoted.page_id = pageId;
  if (recipe.promotedObjectKeys.includes("pixel_id") && pixelId) promoted.pixel_id = pixelId;
  if (recipe.promotedObjectKeys.includes("custom_event_type") && recipe.conversionEvent && pixelId) {
    promoted.custom_event_type = recipe.conversionEvent;
  }
  if (recipe.promotedObjectKeys.includes("lead_gen_form_id") && formId) {
    promoted.lead_gen_form_id = formId;
  }
  if (recipe.promotedObjectKeys.includes("product_catalog_id") && catalogId) {
    promoted.product_catalog_id = catalogId;
  }
  if (recipe.promotedObjectKeys.includes("application_id") && appId) {
    promoted.application_id = appId;
  }

  return Object.keys(promoted).length > 0 ? promoted : undefined;
}

export function buildCampaignPayload(draft: CampaignSubmit) {
  const recipe = getCampaignRecipe(draft.recipeId!);
  if (!recipe) throw new Error("Recipe seçilmedi");
  const categories = draft.specialAdCategory === "NONE" ? [] : [draft.specialAdCategory];
  return {
    name: draft.campaignName.trim(),
    objective: recipe.objective,
    buyingType: recipe.buyingType,
    specialAdCategories: categories,
    status: "PAUSED" as const,
  };
}

export function buildAdSetPayload(draft: CampaignSubmit, campaignId: string) {
  const recipe = getCampaignRecipe(draft.recipeId!);
  if (!recipe) throw new Error("Recipe seçilmedi");

  const startTime = draft.startDate ? `${draft.startDate}T00:00:00` : undefined;
  const endTime = draft.endDate ? `${draft.endDate}T00:00:00` : undefined;

  return {
    name: `${draft.campaignName.trim()} - Reklam Seti`,
    campaignId,
    dailyBudget: draft.dailyBudget,
    status: "PAUSED" as const,
    billingEvent: recipe.billingEvent,
    optimizationGoal: recipe.optimizationGoal,
    destinationType:
      recipe.destinationType !== "UNDEFINED" ? recipe.destinationType : undefined,
    targeting: buildTargetingFromSubmit(draft),
    promotedObject: buildPromotedObject(draft.recipeId!, draft),
    startTime,
    endTime,
  };
}

export function buildObjectStorySpec(draft: CampaignSubmit) {
  const recipe = getCampaignRecipe(draft.recipeId!);
  if (!recipe) throw new Error("Recipe seçilmedi");

  const pageId = draft.selectedAssets.page?.id ?? draft.pageId;
  const instagramActorId =
    (draft.selectedAssets.instagram?.id ?? draft.instagramActorId?.trim()) || undefined;
  const formId = draft.selectedAssets.instantForm?.id ?? draft.instantFormId;

  const linkData: Record<string, unknown> = {
    message: draft.primaryText.trim(),
    image_hash: draft.imageHash,
    name: draft.headline.trim(),
    call_to_action: {
      type: draft.cta,
      value: draft.websiteUrl?.trim() ? { link: draft.websiteUrl.trim() } : {},
    },
  };
  if (draft.websiteUrl?.trim()) linkData.link = draft.websiteUrl.trim();
  if (draft.description?.trim()) linkData.description = draft.description.trim();
  if (formId) linkData.lead_gen_form_id = formId;

  const objectStorySpec: Record<string, unknown> = {
    page_id: pageId,
    link_data: linkData,
  };
  if (instagramActorId) objectStorySpec.instagram_actor_id = instagramActorId;
  return objectStorySpec;
}

export function buildCreativePayload(draft: CampaignSubmit) {
  const pageId = draft.selectedAssets.page?.id ?? draft.pageId;
  const instagramActorId =
    (draft.selectedAssets.instagram?.id ?? draft.instagramActorId?.trim()) || undefined;
  const formId = draft.selectedAssets.instantForm?.id ?? draft.instantFormId;

  return {
    name: `${draft.campaignName.trim()} - Creative`,
    pageId,
    instagramActorId,
    websiteUrl: draft.websiteUrl?.trim() || undefined,
    imageHash: draft.imageHash,
    primaryText: draft.primaryText.trim(),
    headline: draft.headline.trim(),
    description: draft.description?.trim() || undefined,
    ctaType: draft.cta,
    leadGenFormId: formId,
  };
}

export function buildAdPayload(draft: CampaignSubmit, adSetId: string, creativeId?: string) {
  return {
    name: `${draft.campaignName.trim()} - Reklam`,
    adSetId,
    creativeId,
    status: "PAUSED" as const,
  };
}
