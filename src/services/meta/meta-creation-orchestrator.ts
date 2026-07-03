import { getMetaConnection } from "@/lib/db";
import { createAd, createAdCreative, createAdSet, createCampaign } from "@/lib/meta";
import type { CampaignRecipeId } from "@/config/campaign-recipes";
import type { CampaignSubmit, WizardCreateResult, WizardCreateStep } from "@/types/campaign-wizard";
import {
  buildAdPayload,
  buildAdSetPayload,
  buildCampaignPayload,
  buildCreativePayload,
  buildObjectStorySpec,
} from "@/services/meta/meta-payload-builder";

const USE_INLINE_CREATIVE = process.env.META_INLINE_CREATIVE !== "false";

type PartialIds = {
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
};

function stepResult(
  partial: PartialIds,
  completedStep: WizardCreateStep | null,
  failedStep: WizardCreateStep | null,
  message: string,
  success: boolean,
): WizardCreateResult {
  return { success, completedStep, failedStep, message, ...partial };
}

function nextFailedStep(completed: WizardCreateStep | null): WizardCreateStep {
  const order: WizardCreateStep[] = [
    "upload_image",
    "create_campaign",
    "create_adset",
    "create_creative",
    "create_ad",
  ];
  if (!completed) return "upload_image";
  const idx = order.indexOf(completed);
  return order[Math.min(idx + 1, order.length - 1)] ?? "create_ad";
}

function failedStepLabel(step: WizardCreateStep): string {
  switch (step) {
    case "upload_image":
      return "görsel yükleme";
    case "create_campaign":
      return "kampanya oluşturma";
    case "create_adset":
      return "reklam seti oluşturma";
    case "create_creative":
      return "creative oluşturma";
    case "create_ad":
      return "reklam oluşturma";
  }
}

export function getCreationPostCount(useInlineCreative: boolean): number {
  return useInlineCreative ? 3 : 4;
}

export async function runRecipeWizard(draft: CampaignSubmit): Promise<WizardCreateResult> {
  const connection = await getMetaConnection();
  if (!connection?.selectedAdAccountId) {
    return stepResult({}, null, "create_campaign", "Reklam hesabı seçilmedi", false);
  }
  if (!draft.recipeId) {
    return stepResult({}, null, "create_campaign", "Kampanya hedefi (recipe) seçilmedi", false);
  }

  const partial: PartialIds = {};
  let completed: WizardCreateStep | null = null;

  try {
    if (!draft.imageHash?.trim()) {
      return stepResult(partial, completed, "upload_image", "Görsel yüklenmedi (hash yok)", false);
    }
    completed = "upload_image";

    const campaignPayload = buildCampaignPayload(draft);
    const createdCampaign = await createCampaign(connection.selectedAdAccountId, {
      name: campaignPayload.name,
      objective: campaignPayload.objective,
      buyingType: campaignPayload.buyingType,
      specialAdCategories: campaignPayload.specialAdCategories,
      status: campaignPayload.status,
      isAdsetBudgetSharingEnabled: false,
    });
    partial.campaignId = createdCampaign.id;
    completed = "create_campaign";

    const adsetPayload = buildAdSetPayload(draft, createdCampaign.id);
    const createdAdSet = await createAdSet(connection.selectedAdAccountId, {
      name: adsetPayload.name,
      campaignId: adsetPayload.campaignId,
      dailyBudget: adsetPayload.dailyBudget,
      status: adsetPayload.status,
      billingEvent: adsetPayload.billingEvent,
      optimizationGoal: adsetPayload.optimizationGoal,
      targeting: adsetPayload.targeting,
      promotedObject: adsetPayload.promotedObject,
      destinationType: adsetPayload.destinationType,
      startTime: adsetPayload.startTime,
      endTime: adsetPayload.endTime,
    });
    partial.adSetId = createdAdSet.id;
    completed = "create_adset";

    let creativeId: string | undefined;
    if (USE_INLINE_CREATIVE) {
      completed = "create_creative";
      const createdAd = await createAd(connection.selectedAdAccountId, {
        name: buildAdPayload(draft, createdAdSet.id).name,
        adSetId: createdAdSet.id,
        inlineObjectStorySpec: buildObjectStorySpec(draft),
        status: "PAUSED",
      });
      partial.adId = createdAd.id;
      completed = "create_ad";
    } else {
      const creativePayload = buildCreativePayload(draft);
      const createdCreative = await createAdCreative(connection.selectedAdAccountId, creativePayload);
      partial.creativeId = createdCreative.id;
      creativeId = createdCreative.id;
      completed = "create_creative";

      const adPayload = buildAdPayload(draft, createdAdSet.id, creativeId);
      const createdAd = await createAd(connection.selectedAdAccountId, {
        name: adPayload.name,
        adSetId: adPayload.adSetId,
        creativeId: adPayload.creativeId,
        status: adPayload.status,
      });
      partial.adId = createdAd.id;
      completed = "create_ad";
    }

    return stepResult(
      partial,
      completed,
      null,
      `Reklam oluşturuldu (${draft.recipeId}). Tüm varlıklar PAUSED olarak oluşturuldu.`,
      true,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    const failed = nextFailedStep(completed);
    return stepResult(
      partial,
      completed,
      failed,
      `Oluşturma ${failedStepLabel(failed)} adımında başarısız oldu. Oluşturulan varlıklar PAUSED durumda kalır. Hata: ${message}`,
      false,
    );
  }
}

/** @deprecated Use runRecipeWizard */
export async function runWebsiteSalesWizard(draft: CampaignSubmit): Promise<WizardCreateResult> {
  return runRecipeWizard({
    ...draft,
    recipeId: (draft.recipeId ?? "SALES_WEBSITE") as CampaignRecipeId,
  });
}

export function usesInlineCreative(): boolean {
  return USE_INLINE_CREATIVE;
}
