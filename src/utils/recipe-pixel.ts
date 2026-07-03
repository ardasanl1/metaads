import type { CampaignRecipeId } from "@/config/campaign-recipes";
import { getCampaignRecipe } from "@/config/campaign-recipes";
import type {
  CampaignQuestionnaireAnswers,
  PixelResolution,
} from "@/types/campaign-questionnaire";

export type { PixelResolution };

export function recipeRequiresPixel(recipeId: CampaignRecipeId | string): boolean {
  const recipe = getCampaignRecipe(recipeId);
  if (!recipe) return false;
  return recipe.promotedObjectKeys.includes("pixel_id");
}

export function recipeRequiresWebsiteUrl(recipeId: CampaignRecipeId | string): boolean {
  const recipe = getCampaignRecipe(recipeId);
  if (!recipe) return false;
  return recipe.requiredUserFields.includes("websiteUrl");
}

export function resolveEffectiveRecipeId(
  answers: CampaignQuestionnaireAnswers,
  baseRecipeId: CampaignRecipeId,
): CampaignRecipeId {
  if (
    baseRecipeId === "SALES_WEBSITE" &&
    !answers.selectedAssets.pixel?.id &&
    answers.salesTrafficFallbackAccepted
  ) {
    return "TRAFFIC_WEBSITE";
  }
  return baseRecipeId;
}

export function resolvePixelResolution(
  baseRecipeId: CampaignRecipeId,
  answers: CampaignQuestionnaireAnswers,
): PixelResolution {
  const pixelId = answers.selectedAssets.pixel?.id;
  const pixelName = answers.selectedAssets.pixel?.name ?? pixelId;

  if (!recipeRequiresPixel(baseRecipeId)) {
    return { status: "not_required" };
  }

  if (pixelId) {
    return {
      status: "available",
      pixelId,
      pixelName: pixelName ?? pixelId,
    };
  }

  if (baseRecipeId === "SALES_WEBSITE") {
    return { status: "missing_fallback_available" };
  }

  return { status: "missing_blocking" };
}

export function pixelResolutionBlocksCreation(
  resolution: PixelResolution,
  fallbackAccepted: boolean,
): boolean {
  if (resolution.status === "available" || resolution.status === "not_required") {
    return false;
  }
  if (resolution.status === "missing_fallback_available") {
    return !fallbackAccepted;
  }
  return true;
}
