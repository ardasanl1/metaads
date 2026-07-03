import {
  CAMPAIGN_RECIPES,
  getCampaignRecipe,
  isRecipeEnabled,
  normalizeRecipeId,
  type CampaignRecipeId,
} from "@/config/campaign-recipes";
import {
  getBusinessGoalLabel,
  getDesiredResultLabel,
  resolveRecipeFromAnswers,
} from "@/services/campaign-questionnaire-engine";
import type {
  CampaignQuestionnaireAnswers,
  ResolvedCampaignPlan,
} from "@/types/campaign-questionnaire";
import type { WizardCtaChoice } from "@/types/campaign-wizard";

export type PlanValidationResult = {
  valid: boolean;
  errors: string[];
};

function formatDateLabel(date: string): string {
  return date.replace(/-/g, ".");
}

export function generateAutoNames(
  answers: CampaignQuestionnaireAnswers,
  recipeId: CampaignRecipeId,
): { campaignName: string; adSetName: string; adName: string } {
  const recipe = getCampaignRecipe(recipeId)!;
  const date = formatDateLabel(answers.startDate || new Date().toISOString().slice(0, 10));
  const location = answers.audience.locations[0]?.displayName ?? "Geniş";
  const ageRange = `${answers.audience.ageMin}-${answers.audience.ageMax}`;
  const destination =
    answers.conversionDestination ||
    answers.followUpAnswers.lead_collection_method ||
    recipe.conversionLocation.toLowerCase();
  const cta = answers.creative.cta ?? recipe.defaultCta;

  return {
    campaignName: `${recipe.label} | ${destination} | ${date}`,
    adSetName: `${location} | ${ageRange} | Broad`,
    adName: `Görsel | ${cta} | ${date}`,
  };
}

function buildTargeting(answers: CampaignQuestionnaireAnswers): Record<string, unknown> {
  const targeting: Record<string, unknown> = {
    age_min: answers.audience.ageMin,
    age_max: answers.audience.ageMax,
  };

  const genders = answers.audience.genders.filter((g) => g !== "ALL");
  if (genders.length === 1) {
    targeting.genders = genders[0] === "MALE" ? [1] : [2];
  }

  const location = answers.audience.locations[0] ?? answers.selectedAssets.location;
  if (location) {
    if (location.type === "city") targeting.geo_locations = { cities: [{ key: location.key }] };
    else if (location.type === "region") targeting.geo_locations = { regions: [{ key: location.key }] };
    else if (location.type === "zip") targeting.geo_locations = { zips: [{ key: location.key }] };
    else targeting.geo_locations = { countries: [location.countryCode.toUpperCase()] };
  } else {
    targeting.geo_locations = { countries: ["TR"] };
  }

  return targeting;
}

function buildPromotedObject(
  recipeId: CampaignRecipeId,
  answers: CampaignQuestionnaireAnswers,
): Record<string, unknown> | undefined {
  const recipe = getCampaignRecipe(recipeId)!;
  const assets = answers.selectedAssets;
  const promoted: Record<string, unknown> = {};

  if (recipe.promotedObjectKeys.includes("page_id") && assets.page?.id) {
    promoted.page_id = assets.page.id;
  }
  if (recipe.promotedObjectKeys.includes("pixel_id") && assets.pixel?.id) {
    promoted.pixel_id = assets.pixel.id;
  }
  if (recipe.promotedObjectKeys.includes("custom_event_type") && recipe.conversionEvent) {
    promoted.custom_event_type = recipe.conversionEvent;
  }
  if (recipe.promotedObjectKeys.includes("lead_gen_form_id") && assets.instantForm?.id) {
    promoted.lead_gen_form_id = assets.instantForm.id;
  }
  if (recipe.promotedObjectKeys.includes("product_catalog_id") && assets.catalog?.id) {
    promoted.product_catalog_id = assets.catalog.id;
  }
  if (recipe.promotedObjectKeys.includes("application_id") && assets.app?.id) {
    promoted.application_id = assets.app.id;
  }

  return Object.keys(promoted).length > 0 ? promoted : undefined;
}

function pickCta(recipeId: CampaignRecipeId, answers: CampaignQuestionnaireAnswers): WizardCtaChoice {
  const recipe = getCampaignRecipe(recipeId)!;
  if (answers.creative.cta && recipe.supportedCtas.includes(answers.creative.cta)) {
    return answers.creative.cta;
  }
  return recipe.defaultCta;
}

export function resolveCampaignPlan(answers: CampaignQuestionnaireAnswers): ResolvedCampaignPlan | null {
  const recipeId = resolveRecipeFromAnswers(answers);
  if (!recipeId) return null;

  const canonicalId = normalizeRecipeId(recipeId);
  if (!canonicalId) return null;

  const recipe = getCampaignRecipe(canonicalId);
  if (!recipe) return null;

  const names = generateAutoNames(answers, canonicalId);
  const cta = pickCta(canonicalId, answers);
  const specialCategories =
    answers.specialAdCategoryConfirmed && answers.specialAdCategories.length > 0
      ? answers.specialAdCategories.filter((c) => c !== "NONE")
      : [];

  const unresolvedFields: string[] = [];
  const autoSelected: string[] = [];

  for (const assetKind of recipe.requiredAssets) {
    if (assetKind === "location") {
      if (!answers.audience.locations[0]?.key && !answers.selectedAssets.location?.key) {
        unresolvedFields.push("location");
      }
      continue;
    }
    const key = assetKind as keyof typeof answers.selectedAssets;
    if (answers.selectedAssets[key]) autoSelected.push(assetKind);
    else unresolvedFields.push(assetKind);
  }

  if (recipe.requiredUserFields.includes("websiteUrl") && !answers.creative.destinationUrl?.trim()) {
    unresolvedFields.push("destinationUrl");
  }
  if (!answers.creative.primaryText.trim()) unresolvedFields.push("primaryText");
  if (!answers.creative.headline.trim()) unresolvedFields.push("headline");
  if (!answers.creative.media[0]?.imageHash && !answers.creative.media[0]?.file) {
    unresolvedFields.push("media");
  }

  const explanation = [
    `Hedef: ${getBusinessGoalLabel(answers.businessGoal as never)}`,
    answers.desiredResult
      ? `Sonuç: ${getDesiredResultLabel(answers.desiredResult as never)}`
      : "",
    `Recipe: ${canonicalId}`,
    recipe.enabled ? "Recipe aktif" : "Recipe henüz aktif değil",
  ].filter(Boolean);

  return {
    recipeId: canonicalId,
    recipeEnabled: isRecipeEnabled(canonicalId),

    campaign: {
      name: answers.campaignName?.trim() || names.campaignName,
      objective: recipe.objective,
      buyingType: recipe.buyingType,
      specialAdCategories: specialCategories,
      budgetLevel: recipe.budgetLevel === "ADSET" ? "adset" : "campaign",
      status: "PAUSED",
    },

    adSet: {
      name: answers.adSetName?.trim() || names.adSetName,
      conversionLocation: recipe.conversionLocation,
      destinationType: recipe.destinationType !== "UNDEFINED" ? recipe.destinationType : undefined,
      performanceGoal: recipe.performanceGoal,
      optimizationGoal: recipe.optimizationGoal,
      billingEvent: recipe.billingEvent,
      bidStrategy: recipe.bidStrategy,
      dailyBudget: answers.dailyBudget,
      startTime: answers.startDate ? `${answers.startDate}T00:00:00` : undefined,
      endTime: answers.endDate ? `${answers.endDate}T00:00:00` : undefined,
      promotedObject: buildPromotedObject(canonicalId, answers),
      conversionEvent: recipe.conversionEvent,
      attributionSettings: recipe.attributionWindow
        ? { window: recipe.attributionWindow }
        : undefined,
      placements: { advantage_plus: true, mode: recipe.placements },
      targeting: buildTargeting(answers),
      status: "PAUSED",
    },

    creative: {
      name: `${names.campaignName} - Creative`,
      identity: {
        page_id: answers.selectedAssets.page?.id,
        instagram_actor_id: answers.selectedAssets.instagram?.id,
      },
      format: answers.creative.media[0]?.format ?? "image",
      callToAction: cta,
      destinationUrl: answers.creative.destinationUrl,
      primaryText: answers.creative.primaryText,
      headline: answers.creative.headline,
      description: answers.creative.description,
    },

    ad: {
      name: answers.adName?.trim() || names.adName,
      status: "PAUSED",
    },

    requiredAssets: recipe.requiredAssets,
    automaticallySelectedAssets: autoSelected,
    unresolvedFields,
    explanation,
  };
}

export function validateResolvedCampaignPlan(plan: ResolvedCampaignPlan | null): PlanValidationResult {
  if (!plan) {
    return { valid: false, errors: ["Kampanya planı oluşturulamadı"] };
  }

  const errors: string[] = [];

  if (!plan.recipeEnabled) {
    errors.push(`${plan.recipeId} recipe şu an aktif değil`);
  }

  if (!plan.campaign.name.trim()) errors.push("Kampanya adı eksik");
  if (!plan.campaign.objective) errors.push("Objective eksik");
  if (!plan.adSet.optimizationGoal) errors.push("Optimization goal eksik");
  if (!plan.adSet.billingEvent) errors.push("Billing event eksik");
  if (!plan.adSet.dailyBudget || plan.adSet.dailyBudget <= 0) errors.push("Bütçe geçersiz");
  if (!plan.creative.primaryText.trim()) errors.push("Reklam metni eksik");
  if (!plan.creative.headline.trim()) errors.push("Başlık eksik");
  if (!plan.creative.identity.page_id) errors.push("Facebook Page eksik");

  const recipe = getCampaignRecipe(plan.recipeId);
  if (recipe?.requiredAssets.includes("pixel") && !plan.adSet.promotedObject?.pixel_id) {
    errors.push("Pixel eksik");
  }
  if (recipe?.requiredAssets.includes("instantForm") && !plan.adSet.promotedObject?.lead_gen_form_id) {
    errors.push("Meta form eksik");
  }
  if (recipe?.requiredAssets.includes("whatsapp") && plan.unresolvedFields.includes("whatsapp")) {
    errors.push("WhatsApp bağlantısı eksik");
  }
  if (recipe?.requiredUserFields.includes("websiteUrl") && !plan.creative.destinationUrl?.trim()) {
    errors.push("Website URL eksik");
  }

  for (const field of plan.unresolvedFields) {
    if (!errors.some((e) => e.toLowerCase().includes(field.toLowerCase()))) {
      errors.push(`Eksik alan: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function questionnaireToCampaignDraft(
  answers: CampaignQuestionnaireAnswers,
  plan: ResolvedCampaignPlan,
  imageHash: string,
) {
  const location = answers.audience.locations[0] ?? answers.selectedAssets.location;
  const gender = answers.audience.genders[0] ?? "ALL";

  return {
    recipeId: plan.recipeId,
    campaignName: plan.campaign.name,
    dailyBudget: answers.dailyBudget,
    startDate: answers.startDate,
    endDate: answers.endDate,
    country: null,
    city: null,
    metaCountryCode: location?.countryCode ?? null,
    metaCity: null,
    metaRegion: null,
    selectedAssets: answers.selectedAssets,
    ageMin: answers.audience.ageMin,
    ageMax: answers.audience.ageMax,
    gender,
    websiteUrl: answers.creative.destinationUrl ?? "",
    pageId: answers.selectedAssets.page?.id ?? "",
    instagramActorId: answers.selectedAssets.instagram?.id,
    pixelId: answers.selectedAssets.pixel?.id ?? "",
    instantFormId: answers.selectedAssets.instantForm?.id,
    whatsappId: answers.selectedAssets.whatsapp?.id,
    catalogId: answers.selectedAssets.catalog?.id,
    productSetId: answers.selectedAssets.productSet?.id,
    appId: answers.selectedAssets.app?.id,
    primaryText: answers.creative.primaryText,
    headline: answers.creative.headline,
    description: answers.creative.description,
    cta: plan.creative.callToAction,
    specialAdCategory: answers.specialAdCategories[0] ?? "NONE",
    imageHash,
  };
}

export function recipeNeedsPageBoundAssets(recipeId: CampaignRecipeId): boolean {
  const assets = getCampaignRecipe(recipeId)?.requiredAssets ?? [];
  return assets.some((asset) => ["instagram", "instantForm", "whatsapp"].includes(asset));
}

export { CAMPAIGN_RECIPES, getCampaignRecipe, isRecipeEnabled };
