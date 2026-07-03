import { getCampaignRecipe } from "@/config/campaign-recipes";
import { getMetaConnection } from "@/lib/db";
import { MetaApiError, createAd, createAdCreative, createAdSet, createCampaign, getCampaign } from "@/lib/meta";
import type { CampaignRecipeId } from "@/config/campaign-recipes";
import type {
  CampaignSubmit,
  WizardCreateResult,
  WizardCreateStep,
  WizardCreationDebug,
  WizardDebugStepInfo,
  WizardMetaError,
} from "@/types/campaign-wizard";
import {
  buildAdPayload,
  buildAdSetPayload,
  buildCampaignPayload,
  buildCreativePayload,
  buildObjectStorySpec,
} from "@/services/meta/meta-payload-builder";
import { validateDailyBudget } from "@/utils/meta-budget";

const USE_INLINE_CREATIVE = process.env.META_INLINE_CREATIVE !== "false";
const IS_DEV = process.env.NODE_ENV !== "production";

type PartialIds = {
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
};

export type WizardDebugStep = WizardDebugStepInfo;

export type { WizardCreationDebug };

function stepResult(
  partial: PartialIds,
  completedStep: WizardCreateStep | null,
  failedStep: WizardCreateStep | null,
  message: string,
  success: boolean,
  extra?: {
    metaError?: WizardMetaError;
    debug?: WizardCreationDebug;
    effectiveRecipeId?: CampaignRecipeId;
  },
): WizardCreateResult {
  return {
    success,
    completedStep,
    failedStep,
    message,
    ...partial,
    metaError: extra?.metaError,
    debug: IS_DEV ? extra?.debug : undefined,
    effectiveRecipeId: extra?.effectiveRecipeId,
  };
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

function resolveEffectiveRecipeId(draft: CampaignSubmit): CampaignRecipeId {
  return (draft.effectiveRecipeId ?? draft.recipeId)!;
}

function metaErrorFromCaught(error: unknown): WizardMetaError | undefined {
  if (error instanceof MetaApiError && error.metaError) {
    return error.metaError;
  }
  return undefined;
}

function pushDebugStep(debug: WizardCreationDebug, step: WizardDebugStep): void {
  const idx = debug.steps.findIndex((s) => s.step === step.step);
  if (idx >= 0) debug.steps[idx] = step;
  else debug.steps.push(step);
}

export function getCreationPostCount(useInlineCreative: boolean): number {
  return useInlineCreative ? 3 : 4;
}

export async function runRecipeWizard(draft: CampaignSubmit): Promise<WizardCreateResult> {
  const connection = await getMetaConnection();
  if (!connection?.selectedAdAccountId) {
    return stepResult({}, null, "create_campaign", "Reklam hesabı seçilmedi", false);
  }

  if (!draft.effectiveRecipeId) {
    return stepResult({}, null, "create_campaign", "effectiveRecipeId gerekli", false);
  }

  const effectiveRecipeId = resolveEffectiveRecipeId(draft);
  const recipe = getCampaignRecipe(effectiveRecipeId);
  if (!recipe) {
    return stepResult({}, null, "create_campaign", "Geçersiz recipe", false);
  }

  const budgetCheck = validateDailyBudget({ amount: draft.dailyBudget, currency: "TRY" });
  if (!budgetCheck.valid) {
    return stepResult({}, null, "create_campaign", budgetCheck.message ?? "Bütçe geçersiz", false, {
      effectiveRecipeId,
    });
  }

  const partial: PartialIds = {};
  let completed: WizardCreateStep | null = null;

  const debug: WizardCreationDebug = {
    effectiveRecipeId,
    baseRecipeId: draft.baseRecipeId,
    dailyBudgetUi: draft.dailyBudget,
    steps: [
      { step: "media_upload", status: "not_started" },
      { step: "campaign", status: "not_started" },
      { step: "adset", status: "not_started" },
      { step: "creative", status: "not_started" },
      { step: "ad", status: "not_started" },
    ],
  };

  const draftWithRecipe: CampaignSubmit = {
    ...draft,
    recipeId: effectiveRecipeId,
    effectiveRecipeId,
  };

  try {
    if (!draft.imageHash?.trim()) {
      pushDebugStep(debug, { step: "media_upload", status: "failed" });
      return stepResult(
        partial,
        completed,
        "upload_image",
        "Görsel yüklenmedi (hash yok)",
        false,
        { debug, effectiveRecipeId },
      );
    }
    pushDebugStep(debug, { step: "media_upload", status: "success" });
    completed = "upload_image";

    let campaignId = draft.resume?.campaignId;

    if (!campaignId) {
      const campaignPayload = buildCampaignPayload(draftWithRecipe);
      const createdCampaign = await createCampaign(connection.selectedAdAccountId, {
        name: campaignPayload.name,
        objective: campaignPayload.objective,
        buyingType: campaignPayload.buyingType,
        specialAdCategories: campaignPayload.specialAdCategories,
        status: campaignPayload.status,
        isAdsetBudgetSharingEnabled: false,
      });
      campaignId = createdCampaign.id;
      pushDebugStep(debug, {
        step: "campaign",
        status: "success",
        entityId: campaignId,
        recipeId: effectiveRecipeId,
        sanitizedPayload: campaignPayload as unknown as Record<string, unknown>,
      });
    } else {
      pushDebugStep(debug, {
        step: "campaign",
        status: "skipped",
        entityId: campaignId,
        recipeId: effectiveRecipeId,
      });
    }

    partial.campaignId = campaignId;
    completed = "create_campaign";

    const campaignRecord = await getCampaign(campaignId);
    if (!campaignRecord) {
      throw new MetaApiError("Oluşturulan kampanya doğrulanamadı", 502);
    }
    debug.campaignObjective = campaignRecord.objective;

    if (campaignRecord.objective !== recipe.objective) {
      return stepResult(
        partial,
        completed,
        "create_adset",
        `Kampanya objective uyumsuz: beklenen ${recipe.objective}, oluşan ${campaignRecord.objective}. Yeni plan onayı gerekir.`,
        false,
        { debug, effectiveRecipeId },
      );
    }

    let adSetId = draft.resume?.adSetId;

    if (!adSetId) {
      const adsetPayload = buildAdSetPayload(draftWithRecipe, campaignId);
      debug.dailyBudgetSent = adsetPayload.daily_budget;
      debug.targetingSent = adsetPayload.targeting;

      pushDebugStep(debug, {
        step: "adset",
        status: "not_started",
        recipeId: effectiveRecipeId,
        sanitizedPayload: adsetPayload as unknown as Record<string, unknown>,
      });

      const createdAdSet = await createAdSet(connection.selectedAdAccountId, adsetPayload);
      adSetId = createdAdSet.id;
      pushDebugStep(debug, {
        step: "adset",
        status: "success",
        entityId: adSetId,
        recipeId: effectiveRecipeId,
        sanitizedPayload: adsetPayload as unknown as Record<string, unknown>,
      });
    } else {
      pushDebugStep(debug, {
        step: "adset",
        status: "skipped",
        entityId: adSetId,
        recipeId: effectiveRecipeId,
      });
    }

    partial.adSetId = adSetId;
    completed = "create_adset";

    if (!draft.selectedAssets.page?.id && !draft.pageId?.trim()) {
      throw new MetaApiError("Facebook Page ID eksik", 400);
    }
    if (!draft.websiteUrl?.trim() && effectiveRecipeId === "TRAFFIC_WEBSITE") {
      throw new MetaApiError("Website URL eksik", 400);
    }

    let creativeId: string | undefined = draft.resume?.creativeId;

    if (USE_INLINE_CREATIVE) {
      pushDebugStep(debug, { step: "creative", status: "skipped", recipeId: effectiveRecipeId });
      completed = "create_creative";

      const createdAd = await createAd(connection.selectedAdAccountId, {
        name: buildAdPayload(draftWithRecipe, adSetId).name,
        adSetId,
        inlineObjectStorySpec: buildObjectStorySpec(draftWithRecipe),
        status: "PAUSED",
      });
      partial.adId = createdAd.id;
      pushDebugStep(debug, {
        step: "ad",
        status: "success",
        entityId: createdAd.id,
        recipeId: effectiveRecipeId,
      });
      completed = "create_ad";
    } else {
      if (!creativeId) {
        const creativePayload = buildCreativePayload(draftWithRecipe);
        const createdCreative = await createAdCreative(
          connection.selectedAdAccountId,
          creativePayload,
        );
        creativeId = createdCreative.id;
        pushDebugStep(debug, {
          step: "creative",
          status: "success",
          entityId: creativeId,
          recipeId: effectiveRecipeId,
        });
      } else {
        pushDebugStep(debug, {
          step: "creative",
          status: "skipped",
          entityId: creativeId,
          recipeId: effectiveRecipeId,
        });
      }
      partial.creativeId = creativeId;
      completed = "create_creative";

      const adPayload = buildAdPayload(draftWithRecipe, adSetId, creativeId);
      const createdAd = await createAd(connection.selectedAdAccountId, {
        name: adPayload.name,
        adSetId: adPayload.adSetId,
        creativeId: adPayload.creativeId,
        status: adPayload.status,
      });
      partial.adId = createdAd.id;
      pushDebugStep(debug, {
        step: "ad",
        status: "success",
        entityId: createdAd.id,
        recipeId: effectiveRecipeId,
      });
      completed = "create_ad";
    }

    return stepResult(
      partial,
      completed,
      null,
      `Reklam oluşturuldu (${effectiveRecipeId}). Tüm varlıklar PAUSED olarak oluşturuldu.`,
      true,
      { debug, effectiveRecipeId },
    );
  } catch (error) {
    const metaError = metaErrorFromCaught(error);
    const failed = nextFailedStep(completed);
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";

    const failedDebugStep: WizardDebugStep["step"] =
      failed === "create_campaign"
        ? "campaign"
        : failed === "create_adset"
          ? "adset"
          : failed === "create_creative"
            ? "creative"
            : failed === "create_ad"
              ? "ad"
              : "media_upload";

    pushDebugStep(debug, {
      step: failedDebugStep,
      status: "failed",
      recipeId: effectiveRecipeId,
      metaError,
      sanitizedPayload:
        failedDebugStep === "adset"
          ? (debug.steps.find((s) => s.step === "adset")?.sanitizedPayload ?? undefined)
          : undefined,
    });

    if (failed === "create_creative" || failed === "create_ad") {
      pushDebugStep(debug, { step: "creative", status: "not_started" });
      pushDebugStep(debug, { step: "ad", status: "not_started" });
    }

    return stepResult(
      partial,
      completed,
      failed,
      `Oluşturma ${failedStepLabel(failed)} adımında başarısız oldu. Oluşturulan varlıklar PAUSED durumda kalır. Hata: ${message}`,
      false,
      {
        metaError: metaError ? { ...metaError, step: failedDebugStep } : undefined,
        debug,
        effectiveRecipeId,
      },
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
