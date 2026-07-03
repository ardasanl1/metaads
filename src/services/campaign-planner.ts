import {
  CAMPAIGN_RECIPES,
  getCampaignRecipe,
  type CampaignRecipe,
  type CampaignRecipeId,
  type CampaignUserField,
} from "@/config/campaign-recipes";
import type { CampaignDraft, WizardStepId } from "@/types/campaign-wizard";
import type { MetaAssetKind } from "@/types/meta-assets";

export type WizardPlan = {
  recipe: CampaignRecipe;
  steps: WizardStepId[];
  visibleUserFields: CampaignUserField[];
  requiredAssets: MetaAssetKind[];
  needsWebsiteUrl: boolean;
  needsPixel: boolean;
  needsInstantForm: boolean;
  needsWhatsApp: boolean;
  needsCatalog: boolean;
  needsApp: boolean;
};

const BASE_STEPS: WizardStepId[] = ["goal", "campaign_budget", "audience", "meta_assets", "ad_content", "review_create"];

export function buildWizardPlan(recipeId: CampaignRecipeId): WizardPlan | null {
  const recipe = getCampaignRecipe(recipeId);
  if (!recipe) return null;

  const needsWebsiteUrl = recipe.requiredUserFields.includes("websiteUrl");
  const needsPixel = recipe.requiredAssets.includes("pixel");
  const needsInstantForm = recipe.requiredAssets.includes("instantForm");
  const needsWhatsApp = recipe.requiredAssets.includes("whatsapp");
  const needsCatalog = recipe.requiredAssets.includes("catalog") || recipe.requiredAssets.includes("productSet");
  const needsApp = recipe.requiredAssets.includes("app");

  const hasAssetStep =
    recipe.requiredAssets.some((asset) => asset !== "location") ||
    needsPixel ||
    needsInstantForm ||
    needsWhatsApp ||
    needsCatalog ||
    needsApp;

  const steps = BASE_STEPS.filter((step) => {
    if (step === "meta_assets") return hasAssetStep;
    return true;
  });

  return {
    recipe,
    steps,
    visibleUserFields: recipe.requiredUserFields,
    requiredAssets: recipe.requiredAssets,
    needsWebsiteUrl,
    needsPixel,
    needsInstantForm,
    needsWhatsApp,
    needsCatalog,
    needsApp,
  };
}

export function generateCampaignName(recipeId: CampaignRecipeId, date = new Date()): string {
  const recipe = CAMPAIGN_RECIPES[recipeId];
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${recipe.label} - ${yyyy}-${mm}-${dd}`;
}

export function applyRecipeDefaults(draft: CampaignDraft, recipeId: CampaignRecipeId): CampaignDraft {
  const recipe = CAMPAIGN_RECIPES[recipeId];
  return {
    ...draft,
    recipeId,
    campaignName: draft.campaignName.trim() || generateCampaignName(recipeId),
    cta: draft.cta || recipe.defaultCta,
  };
}

export function getTechnicalSummary(recipeId: CampaignRecipeId) {
  const recipe = CAMPAIGN_RECIPES[recipeId];
  return {
    objective: recipe.objective,
    conversionLocation: recipe.conversionLocation,
    destinationType: recipe.destinationType,
    optimizationGoal: recipe.optimizationGoal,
    billingEvent: recipe.billingEvent,
    bidStrategy: recipe.bidStrategy,
    budgetLevel: recipe.budgetLevel,
    placements: recipe.placements,
    conversionEvent: recipe.conversionEvent ?? "—",
    promotedObjectKeys: recipe.promotedObjectKeys.join(", "),
    attribution: recipe.attributionWindow ?? "Varsayılan",
    status: recipe.defaults.status,
  };
}

export function recipeNeedsPageBoundAssets(recipeId: CampaignRecipeId): boolean {
  const assets = getCampaignRecipe(recipeId)?.requiredAssets ?? [];
  return assets.some((asset) =>
    ["instagram", "instantForm", "whatsapp"].includes(asset),
  );
}
