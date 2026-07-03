import {
  CAMPAIGN_RECIPES,
  getCampaignRecipe,
  isRecipeEnabled,
  normalizeRecipeId,
  type CampaignRecipeId,
} from "@/config/campaign-recipes";
import {
  getBusinessGoalLabel,
  getConversionDestinationLabelForPlan,
  getDesiredResultLabel,
  getPerformanceGoalLabel,
  resolveRecipeFromAnswers,
} from "@/services/campaign-questionnaire-engine";
import type {
  CampaignQuestionnaireAnswers,
  ResolvedCampaignPlan,
} from "@/types/campaign-questionnaire";
import type { WizardCtaChoice } from "@/types/campaign-wizard";
import {
  recipeRequiresPixel,
  recipeRequiresWebsiteUrl,
  resolveEffectiveRecipeId,
  resolvePixelResolution,
} from "@/utils/recipe-pixel";
import { isAllowedWebsiteUrl, normalizeWebsiteUrl } from "@/utils/url-normalize";
import { buildTargetingFromAudience } from "@/utils/wizard-location";

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
  if (recipe.promotedObjectKeys.includes("custom_event_type") && recipe.conversionEvent && assets.pixel?.id) {
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

function resolveDestinationUrl(answers: CampaignQuestionnaireAnswers): string | undefined {
  const raw = answers.creative.destinationUrl?.trim();
  if (!raw) return undefined;
  return normalizeWebsiteUrl(raw) ?? undefined;
}

export function resolveCampaignPlan(answers: CampaignQuestionnaireAnswers): ResolvedCampaignPlan | null {
  const baseRecipeId = resolveRecipeFromAnswers(answers);
  if (!baseRecipeId) return null;

  const canonicalBase = normalizeRecipeId(baseRecipeId);
  if (!canonicalBase) return null;

  const pixelResolution = resolvePixelResolution(canonicalBase, answers);
  const effectiveRecipeId = resolveEffectiveRecipeId(answers, canonicalBase);
  const recipe = getCampaignRecipe(effectiveRecipeId);
  if (!recipe) return null;

  const names = generateAutoNames(answers, effectiveRecipeId);
  const cta = pickCta(effectiveRecipeId, answers);
  const destinationUrl = resolveDestinationUrl(answers);
  const specialCategories =
    answers.specialAdCategoryConfirmed && answers.specialAdCategories.length > 0
      ? answers.specialAdCategories.filter((c) => c !== "NONE")
      : [];

  const unresolvedFields: string[] = [];
  const autoSelected: string[] = [];

  for (const assetKind of recipe.requiredAssets) {
    if (assetKind === "location") {
      if (!answers.audience.locations[0]?.key) {
        unresolvedFields.push("location");
      }
      continue;
    }
    if (assetKind === "pixel" && pixelResolution.status === "missing_fallback_available") {
      continue;
    }
    const key = assetKind as keyof typeof answers.selectedAssets;
    if (answers.selectedAssets[key]) autoSelected.push(assetKind);
    else unresolvedFields.push(assetKind);
  }

  if (recipeRequiresPixel(effectiveRecipeId)) {
    const pixelInAssets = answers.selectedAssets.pixel?.id;
    if (!pixelInAssets && !unresolvedFields.includes("pixel")) {
      unresolvedFields.push("pixel");
    }
  }

  if (recipeRequiresWebsiteUrl(effectiveRecipeId) && !destinationUrl) {
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
    `Recipe: ${effectiveRecipeId}`,
    recipe.enabled ? "Recipe aktif" : "Recipe henüz aktif değil",
  ].filter(Boolean);

  return {
    recipeId: effectiveRecipeId,
    baseRecipeId: canonicalBase,
    effectiveRecipeId,
    recipeEnabled: isRecipeEnabled(effectiveRecipeId),

    businessGoalLabel: getBusinessGoalLabel(answers.businessGoal as never),
    conversionDestinationLabel: getConversionDestinationLabelForPlan(answers, canonicalBase),
    performanceGoalLabel: getPerformanceGoalLabel(effectiveRecipeId, canonicalBase, answers),
    audience: {
      locations: answers.audience.locations,
      ageMin: answers.audience.ageMin,
      ageMax: answers.audience.ageMax,
      genders: answers.audience.genders,
    },
    pixelResolution,

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
      promotedObject: buildPromotedObject(effectiveRecipeId, answers),
      conversionEvent: recipeRequiresPixel(effectiveRecipeId) ? recipe.conversionEvent : undefined,
      attributionSettings: recipe.attributionWindow
        ? { window: recipe.attributionWindow }
        : undefined,
      placements: { advantage_plus: true, mode: recipe.placements },
      targeting: buildTargetingFromAudience({
        locations: answers.audience.locations,
        ageMin: answers.audience.ageMin,
        ageMax: answers.audience.ageMax,
        genders: answers.audience.genders,
      }),
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
      destinationUrl,
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

export function validateResolvedCampaignPlan(
  plan: ResolvedCampaignPlan | null,
): PlanValidationResult {
  if (!plan) {
    return { valid: false, errors: ["Kampanya planı oluşturulamadı"] };
  }

  const errors: string[] = [];
  const recipe = getCampaignRecipe(plan.effectiveRecipeId);

  if (!plan.recipeEnabled) {
    errors.push(`${plan.effectiveRecipeId} recipe şu an aktif değil`);
  }

  if (!plan.campaign.name.trim()) errors.push("Kampanya adı eksik");
  if (!plan.campaign.objective) errors.push("Objective eksik");
  if (!plan.adSet.optimizationGoal) errors.push("Optimization goal eksik");
  if (!plan.adSet.billingEvent) errors.push("Billing event eksik");
  if (!plan.adSet.dailyBudget || plan.adSet.dailyBudget <= 0) errors.push("Bütçe geçersiz");
  if (!plan.creative.primaryText.trim()) errors.push("Reklam metni eksik");
  if (!plan.creative.headline.trim()) errors.push("Başlık eksik");
  if (!plan.creative.identity.page_id) errors.push("Facebook Page eksik");

  if (!plan.audience.locations[0]?.key) {
    errors.push("Hedef konum eksik");
  }

  if (recipeRequiresWebsiteUrl(plan.effectiveRecipeId)) {
    if (!plan.creative.destinationUrl?.trim()) {
      errors.push("Website URL eksik");
    } else if (!isAllowedWebsiteUrl(plan.creative.destinationUrl)) {
      errors.push("Geçerli bir Website URL girin");
    }
  }

  if (
    recipeRequiresPixel(plan.effectiveRecipeId) &&
    !plan.adSet.promotedObject?.pixel_id &&
    plan.pixelResolution.status === "missing_blocking"
  ) {
    errors.push("Pixel eksik");
  }

  if (recipe?.requiredAssets.includes("instantForm") && !plan.adSet.promotedObject?.lead_gen_form_id) {
    errors.push("Meta form eksik");
  }
  if (recipe?.requiredAssets.includes("whatsapp") && plan.unresolvedFields.includes("whatsapp")) {
    errors.push("WhatsApp bağlantısı eksik");
  }

  for (const field of plan.unresolvedFields) {
    if (field === "pixel" && !recipeRequiresPixel(plan.effectiveRecipeId)) continue;
    if (field === "destinationUrl" && recipeRequiresWebsiteUrl(plan.effectiveRecipeId)) continue;
    if (!errors.some((e) => e.toLowerCase().includes(field.toLowerCase()))) {
      errors.push(`Eksik alan: ${field}`);
    }
  }

  if (
    recipeRequiresWebsiteUrl(plan.effectiveRecipeId) &&
    plan.creative.destinationUrl &&
    !plan.adSet.promotedObject?.pixel_id &&
    plan.effectiveRecipeId !== "TRAFFIC_WEBSITE"
  ) {
    // website sales with pixel - ok
  }

  return { valid: errors.length === 0, errors };
}

export function questionnaireToCampaignDraft(
  answers: CampaignQuestionnaireAnswers,
  plan: ResolvedCampaignPlan,
  imageHash: string,
) {
  const primaryLocation = plan.audience.locations[0];
  const gender = answers.audience.genders[0] ?? "ALL";
  const websiteUrl = plan.creative.destinationUrl ?? "";

  return {
    recipeId: plan.effectiveRecipeId,
    campaignName: plan.campaign.name,
    dailyBudget: answers.dailyBudget,
    startDate: answers.startDate,
    endDate: answers.endDate,
    country: null,
    city: null,
    metaCountryCode: primaryLocation?.countryCode ?? null,
    metaCity: null,
    metaRegion: null,
    selectedAssets: {
      ...answers.selectedAssets,
      location: primaryLocation
        ? {
            key: primaryLocation.key,
            type: primaryLocation.type,
            displayName: primaryLocation.displayName,
            countryCode: primaryLocation.countryCode,
          }
        : answers.selectedAssets.location,
      pixel:
        recipeRequiresPixel(plan.effectiveRecipeId) && answers.selectedAssets.pixel?.id
          ? answers.selectedAssets.pixel
          : undefined,
    },
    audienceLocations: plan.audience.locations,
    ageMin: plan.audience.ageMin,
    ageMax: plan.audience.ageMax,
    gender,
    websiteUrl,
    pageId: answers.selectedAssets.page?.id ?? "",
    instagramActorId: answers.selectedAssets.instagram?.id,
    pixelId: recipeRequiresPixel(plan.effectiveRecipeId)
      ? (answers.selectedAssets.pixel?.id ?? "")
      : "",
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
