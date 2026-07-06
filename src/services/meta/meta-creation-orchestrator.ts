import { getCampaignRecipe } from "@/config/campaign-recipes";
import { getMetaConnection } from "@/lib/db";
import { MetaApiError, createAd, createAdCreative, createAdSet, createCampaign, getCampaign } from "@/lib/meta";
import type { CampaignRecipeId } from "@/config/campaign-recipes";
import type {
  CampaignCreationResult,
  CampaignCreationStep,
  CampaignSubmit,
  WizardCreationDebug,
  WizardDebugStepInfo,
  WizardMetaError,
} from "@/types/campaign-wizard";
import {
  buildAdPayload,
  buildAdSetPayload,
  buildCampaignPayload,
  buildCreativePayload,
} from "@/services/meta/meta-payload-builder";
import { validateCampaignSubmitForCreation } from "@/utils/campaign-wizard-validation";

const IS_DEV = process.env.NODE_ENV !== "production";

type PartialIds = {
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
};

export type WizardDebugStep = WizardDebugStepInfo;
export type { WizardCreationDebug };

function legacyStep(step: CampaignCreationStep): CampaignCreationResult["completedStepLegacy"] {
  const map: Record<CampaignCreationStep, CampaignCreationResult["completedStepLegacy"]> = {
    none: null,
    media: "upload_image",
    campaign: "create_campaign",
    adset: "create_adset",
    creative: "create_creative",
    ad: "create_ad",
  };
  return map[step];
}

function buildResult(
  partial: PartialIds,
  completedStep: CampaignCreationStep,
  failedStep: CampaignCreationStep | undefined,
  message: string,
  success: boolean,
  effectiveRecipeId: CampaignRecipeId,
  extra?: {
    metaError?: WizardMetaError;
    debug?: WizardCreationDebug;
    inlineCreativeUsed?: boolean;
  },
): CampaignCreationResult {
  return {
    success,
    completedStep,
    failedStep,
    message,
    effectiveRecipeId,
    ...partial,
    inlineCreativeUsed: extra?.inlineCreativeUsed,
    metaError: extra?.metaError,
    debug: IS_DEV ? extra?.debug : undefined,
    completedStepLegacy: legacyStep(completedStep),
    failedStepLegacy: failedStep ? legacyStep(failedStep) : undefined,
  };
}

function isFullySuccessful(
  partial: PartialIds,
  inlineCreativeUsed: boolean,
): boolean {
  if (!partial.campaignId || !partial.adSetId || !partial.adId) return false;
  if (!inlineCreativeUsed && !partial.creativeId) return false;
  return true;
}

function metaErrorFromCaught(error: unknown): WizardMetaError | undefined {
  if (error instanceof MetaApiError && error.metaError) {
    return error.metaError;
  }
  return undefined;
}

function pushDebugStep(debug: WizardCreationDebug, step: WizardDebugStepInfo): void {
  const idx = debug.steps.findIndex((s) => s.step === step.step);
  if (idx >= 0) debug.steps[idx] = step;
  else debug.steps.push(step);
}

function stepStatusLabel(step: CampaignCreationStep, status: "success" | "failed" | "skipped" | "not_started"): string {
  const names: Record<CampaignCreationStep, string> = {
    none: "Başlatılmadı",
    media: "Medya yükleme",
    campaign: "Campaign",
    adset: "Ad Set",
    creative: "Creative",
    ad: "Ad",
  };
  const statusText =
    status === "success"
      ? "oluşturuldu"
      : status === "failed"
        ? "oluşturulamadı"
        : status === "skipped"
          ? "atlandı"
          : "başlatılmadı";
  return `${names[step]} ${statusText}`;
}

export function buildCreationStatusSummary(
  result: CampaignCreationResult,
): string[] {
  const lines: string[] = [];
  const debug = result.debug;
  if (!debug) {
    lines.push(result.message);
    return lines;
  }

  for (const step of debug.steps) {
    const map: Record<WizardDebugStepInfo["step"], CampaignCreationStep> = {
      media_upload: "media",
      campaign: "campaign",
      adset: "adset",
      creative: "creative",
      ad: "ad",
    };
    const label = stepStatusLabel(map[step.step], step.status);
    if (step.entityId) lines.push(`${label} (ID: ${step.entityId})`);
    else lines.push(label);
  }
  return lines;
}

function partialFailureMessage(
  failedStep: CampaignCreationStep,
  partial: PartialIds,
  detail: string,
): string {
  if (failedStep === "adset" && partial.campaignId) {
    return `Campaign oluşturuldu ancak Ad Set oluşturulamadı. Oluşturulan Campaign PAUSED durumda kaldı. ${detail}`;
  }
  if (failedStep === "creative" && partial.campaignId && partial.adSetId) {
    return `Campaign ve Ad Set oluşturuldu ancak Creative oluşturulamadı. ${detail}`;
  }
  if (failedStep === "ad" && partial.campaignId && partial.adSetId) {
    return `Campaign ve Ad Set oluşturuldu ancak Ad oluşturulamadı. ${detail}`;
  }
  return `Oluşturma ${failedStep} adımında başarısız oldu. ${detail}`;
}

export function getCreationPostCount(): number {
  return 4;
}

/**
 * Campaign + Ad Set + Creative + Ad zincirini uçtan uca oluşturur.
 * Yalnızca campaignId varsa success=false döner.
 */
export async function createFullAdCampaignPlan(
  draft: CampaignSubmit,
): Promise<CampaignCreationResult> {
  const connection = await getMetaConnection();
  if (!connection?.selectedAdAccountId) {
    return buildResult({}, "none", "campaign", "Reklam hesabı seçilmedi", false, draft.effectiveRecipeId ?? "TRAFFIC_WEBSITE");
  }

  const precheck = validateCampaignSubmitForCreation(draft, connection.selectedAdAccountId);
  if (!precheck.valid) {
    return buildResult(
      {},
      "none",
      "media",
      precheck.errors[0] ?? "Plan doğrulaması başarısız",
      false,
      draft.effectiveRecipeId ?? "TRAFFIC_WEBSITE",
    );
  }

  const effectiveRecipeId = draft.effectiveRecipeId!;
  const recipe = getCampaignRecipe(effectiveRecipeId)!;

  const partial: PartialIds = {};
  let completedStep: CampaignCreationStep = "none";

  const debug: WizardCreationDebug = {
    effectiveRecipeId,
    baseRecipeId: draft.baseRecipeId,
    dailyBudgetUi: draft.dailyBudget,
    currency: "TRY",
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

  const fail = (
    failedStep: CampaignCreationStep,
    message: string,
    metaError?: WizardMetaError,
    failedDebugStep?: WizardDebugStepInfo["step"],
  ): CampaignCreationResult => {
    if (failedDebugStep) {
      pushDebugStep(debug, {
        step: failedDebugStep,
        status: "failed",
        recipeId: effectiveRecipeId,
        metaError,
        sanitizedPayload:
          failedDebugStep === "adset"
            ? debug.adSetPayload
            : failedDebugStep === "campaign"
              ? debug.campaignPayload
              : failedDebugStep === "creative"
                ? debug.creativePayload
                : failedDebugStep === "ad"
                  ? debug.adPayload
                  : undefined,
      });
    }
    if (failedStep === "creative" || failedStep === "ad") {
      const creativeIdx = debug.steps.findIndex((s) => s.step === "creative");
      if (creativeIdx >= 0 && debug.steps[creativeIdx].status === "not_started") {
        pushDebugStep(debug, { step: "creative", status: "not_started" });
      }
      if (failedStep === "ad") {
        pushDebugStep(debug, { step: "ad", status: "not_started" });
      }
    }
    return buildResult(
      partial,
      completedStep,
      failedStep,
      message,
      false,
      effectiveRecipeId,
      { metaError: metaError ? { ...metaError, step: failedDebugStep } : undefined, debug },
    );
  };

  try {
    // 1. Medya
    if (!draft.imageHash?.trim()) {
      return fail("media", "Görsel yüklenmedi (hash yok)", undefined, "media_upload");
    }
    pushDebugStep(debug, {
      step: "media_upload",
      status: "success",
      sanitizedPayload: { image_hash: draft.imageHash },
    });
    completedStep = "media";

    // 2. Campaign
    let campaignId = draft.resume?.campaignId;
    const campaignPayload = buildCampaignPayload(draftWithRecipe);
    debug.campaignPayload = campaignPayload as unknown as Record<string, unknown>;

    if (!campaignId) {
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
        sanitizedPayload: debug.campaignPayload,
      });
    } else {
      pushDebugStep(debug, {
        step: "campaign",
        status: "skipped",
        entityId: campaignId,
        recipeId: effectiveRecipeId,
        sanitizedPayload: debug.campaignPayload,
      });
    }

    partial.campaignId = campaignId;
    completedStep = "campaign";

    const campaignRecord = await getCampaign(campaignId);
    if (!campaignRecord) {
      throw new MetaApiError("Oluşturulan kampanya doğrulanamadı", 502);
    }
    debug.campaignObjective = campaignRecord.objective;

    if (campaignRecord.objective !== recipe.objective) {
      return fail(
        "adset",
        `Campaign objective ile ad set recipe uyumsuz: beklenen ${recipe.objective}, oluşan ${campaignRecord.objective}. Yeni plan onayı gerekir.`,
        undefined,
        "adset",
      );
    }

    // 3. Ad Set
    let adSetId = draft.resume?.adSetId;
    const adsetPayload = buildAdSetPayload(draftWithRecipe, campaignId);
    debug.adSetPayload = adsetPayload as unknown as Record<string, unknown>;
    debug.dailyBudgetSent = adsetPayload.daily_budget;
    debug.targetingSent = adsetPayload.targeting;

    if (!adSetId) {
      pushDebugStep(debug, {
        step: "adset",
        status: "not_started",
        recipeId: effectiveRecipeId,
        sanitizedPayload: debug.adSetPayload,
      });

      const createdAdSet = await createAdSet(connection.selectedAdAccountId, adsetPayload);
      adSetId = createdAdSet.id;
      pushDebugStep(debug, {
        step: "adset",
        status: "success",
        entityId: adSetId,
        recipeId: effectiveRecipeId,
        sanitizedPayload: debug.adSetPayload,
      });
    } else {
      pushDebugStep(debug, {
        step: "adset",
        status: "skipped",
        entityId: adSetId,
        recipeId: effectiveRecipeId,
        sanitizedPayload: debug.adSetPayload,
      });
    }

    partial.adSetId = adSetId;
    completedStep = "adset";

    // 4. Creative (ayrı adım — inline creative kullanılmaz)
    let creativeId = draft.resume?.creativeId;
    const creativePayload = buildCreativePayload(draftWithRecipe);
    debug.creativePayload = creativePayload as unknown as Record<string, unknown>;

    if (!creativeId) {
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
        sanitizedPayload: debug.creativePayload,
      });
    } else {
      pushDebugStep(debug, {
        step: "creative",
        status: "skipped",
        entityId: creativeId,
        recipeId: effectiveRecipeId,
        sanitizedPayload: debug.creativePayload,
      });
    }

    partial.creativeId = creativeId;
    completedStep = "creative";

    // 5. Ad
    const adPayload = buildAdPayload(draftWithRecipe, adSetId, creativeId);
    debug.adPayload = adPayload as unknown as Record<string, unknown>;

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
      sanitizedPayload: debug.adPayload,
    });
    completedStep = "ad";

    const success = isFullySuccessful(partial, false);
    if (!success) {
      return buildResult(
        partial,
        completedStep,
        "ad",
        "Oluşturma tamamlanamadı: eksik entity ID",
        false,
        effectiveRecipeId,
        { debug },
      );
    }

    return buildResult(
      partial,
      "ad",
      undefined,
      `Tam reklam zinciri oluşturuldu (${effectiveRecipeId}). Campaign, Ad Set, Creative ve Ad PAUSED durumda.`,
      true,
      effectiveRecipeId,
      { debug, inlineCreativeUsed: false },
    );
  } catch (error) {
    const metaError = metaErrorFromCaught(error);
    const detail = error instanceof Error ? error.message : "Bilinmeyen hata";

    const failedStep: CampaignCreationStep =
      completedStep === "none"
        ? "media"
        : completedStep === "media"
          ? "campaign"
          : completedStep === "campaign"
            ? "adset"
            : completedStep === "adset"
              ? "creative"
              : "ad";

    const failedDebugStep: WizardDebugStepInfo["step"] =
      failedStep === "media"
        ? "media_upload"
        : failedStep === "campaign"
          ? "campaign"
          : failedStep === "adset"
            ? "adset"
            : failedStep === "creative"
              ? "creative"
              : "ad";

    return fail(
      failedStep,
      partialFailureMessage(failedStep, partial, detail),
      metaError,
      failedDebugStep,
    );
  }
}

/** @deprecated Use createFullAdCampaignPlan */
export async function runRecipeWizard(draft: CampaignSubmit): Promise<CampaignCreationResult> {
  return createFullAdCampaignPlan(draft);
}

/** @deprecated Use createFullAdCampaignPlan */
export async function runWebsiteSalesWizard(draft: CampaignSubmit): Promise<CampaignCreationResult> {
  return createFullAdCampaignPlan({
    ...draft,
    recipeId: (draft.recipeId ?? "SALES_WEBSITE") as CampaignRecipeId,
    effectiveRecipeId: draft.effectiveRecipeId ?? (draft.recipeId ?? "SALES_WEBSITE"),
  });
}

export function usesInlineCreative(): boolean {
  return false;
}
