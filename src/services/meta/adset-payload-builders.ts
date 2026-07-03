import { getCampaignRecipe } from "@/config/campaign-recipes";
import type { CampaignSubmit } from "@/types/campaign-wizard";
import { convertBudgetToMetaAmount } from "@/utils/meta-budget";
import { sanitizeMetaPayload } from "@/utils/meta-payload-sanitize";
import { buildTargetingFromSubmit } from "@/services/meta/meta-targeting";

export type AdSetPayloadDraft = {
  name: string;
  campaign_id: string;
  daily_budget: number;
  billing_event: string;
  optimization_goal: string;
  targeting: Record<string, unknown>;
  status: "PAUSED";
  bid_strategy?: string;
  destination_type?: string;
  promoted_object?: Record<string, unknown>;
  attribution_spec?: unknown;
  start_time?: string;
  end_time?: string;
};

function formatMetaScheduleTime(dateYmd: string): string | undefined {
  const trimmed = dateYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;

  const scheduled = new Date(`${trimmed}T09:00:00`);
  const now = new Date();
  if (Number.isNaN(scheduled.getTime()) || scheduled <= now) {
    return undefined;
  }

  const offsetMin = -scheduled.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const mins = String(abs % 60).padStart(2, "0");
  const iso = scheduled.toISOString().slice(0, 19);
  return `${iso}${sign}${hours}${mins}`;
}

function buildSalesPromotedObject(draft: CampaignSubmit): Record<string, unknown> | undefined {
  const recipe = getCampaignRecipe("SALES_WEBSITE");
  if (!recipe) return undefined;

  const pixelId = draft.selectedAssets.pixel?.id ?? draft.pixelId;
  if (!pixelId) return undefined;

  const promoted: Record<string, unknown> = {
    pixel_id: pixelId,
  };
  if (recipe.conversionEvent) {
    promoted.custom_event_type = recipe.conversionEvent;
  }
  return promoted;
}

/** Pixel'siz TRAFFIC_WEBSITE — minimum geçerli alanlar */
export function buildTrafficWebsiteAdSetPayload(
  draft: CampaignSubmit,
  campaignId: string,
): AdSetPayloadDraft {
  const recipe = getCampaignRecipe("TRAFFIC_WEBSITE");
  if (!recipe) throw new Error("TRAFFIC_WEBSITE recipe bulunamadı");

  const payload: AdSetPayloadDraft = sanitizeMetaPayload({
    name: `${draft.campaignName.trim()} - Reklam Seti`,
    campaign_id: campaignId,
    daily_budget: convertBudgetToMetaAmount({ amount: draft.dailyBudget, currency: "TRY" }),
    billing_event: recipe.billingEvent,
    optimization_goal: recipe.optimizationGoal,
    targeting: buildTargetingFromSubmit(draft) as Record<string, unknown>,
    status: "PAUSED" as const,
  }) as AdSetPayloadDraft;

  const startTime = draft.startDate ? formatMetaScheduleTime(draft.startDate) : undefined;
  const endTime = draft.endDate ? formatMetaScheduleTime(draft.endDate) : undefined;
  if (startTime) payload.start_time = startTime;
  if (endTime) payload.end_time = endTime;

  return payload;
}

/** SALES_WEBSITE — Pixel ve dönüşüm alanları */
export function buildSalesWebsiteAdSetPayload(
  draft: CampaignSubmit,
  campaignId: string,
): AdSetPayloadDraft {
  const recipe = getCampaignRecipe("SALES_WEBSITE");
  if (!recipe) throw new Error("SALES_WEBSITE recipe bulunamadı");

  const promoted = buildSalesPromotedObject(draft);

  const payload: AdSetPayloadDraft = sanitizeMetaPayload({
    name: `${draft.campaignName.trim()} - Reklam Seti`,
    campaign_id: campaignId,
    daily_budget: convertBudgetToMetaAmount({ amount: draft.dailyBudget, currency: "TRY" }),
    billing_event: recipe.billingEvent,
    optimization_goal: recipe.optimizationGoal,
    bid_strategy: recipe.bidStrategy,
    destination_type: recipe.destinationType !== "UNDEFINED" ? recipe.destinationType : undefined,
    targeting: buildTargetingFromSubmit(draft) as Record<string, unknown>,
    promoted_object: promoted,
    status: "PAUSED" as const,
  }) as AdSetPayloadDraft;

  const startTime = draft.startDate ? formatMetaScheduleTime(draft.startDate) : undefined;
  const endTime = draft.endDate ? formatMetaScheduleTime(draft.endDate) : undefined;
  if (startTime) payload.start_time = startTime;
  if (endTime) payload.end_time = endTime;

  return payload;
}

export function buildAdSetPayloadForRecipe(
  draft: CampaignSubmit,
  campaignId: string,
): AdSetPayloadDraft {
  const recipeId = draft.effectiveRecipeId ?? draft.recipeId;
  if (!recipeId) throw new Error("Recipe seçilmedi");

  if (recipeId === "TRAFFIC_WEBSITE") {
    return buildTrafficWebsiteAdSetPayload(draft, campaignId);
  }
  if (recipeId === "SALES_WEBSITE") {
    return buildSalesWebsiteAdSetPayload(draft, campaignId);
  }

  const recipe = getCampaignRecipe(recipeId);
  if (!recipe) throw new Error("Geçersiz recipe");

  const pageId = draft.selectedAssets.page?.id ?? draft.pageId;
  const pixelId = draft.selectedAssets.pixel?.id ?? draft.pixelId;
  const promoted: Record<string, unknown> = {};
  if (recipe.promotedObjectKeys.includes("page_id") && pageId) promoted.page_id = pageId;
  if (recipe.promotedObjectKeys.includes("pixel_id") && pixelId) promoted.pixel_id = pixelId;
  if (recipe.promotedObjectKeys.includes("custom_event_type") && recipe.conversionEvent && pixelId) {
    promoted.custom_event_type = recipe.conversionEvent;
  }

  return sanitizeMetaPayload({
    name: `${draft.campaignName.trim()} - Reklam Seti`,
    campaign_id: campaignId,
    daily_budget: convertBudgetToMetaAmount({ amount: draft.dailyBudget, currency: "TRY" }),
    billing_event: recipe.billingEvent,
    optimization_goal: recipe.optimizationGoal,
    bid_strategy: recipe.bidStrategy,
    destination_type: recipe.destinationType !== "UNDEFINED" ? recipe.destinationType : undefined,
    targeting: buildTargetingFromSubmit(draft) as Record<string, unknown>,
    promoted_object: Object.keys(promoted).length > 0 ? promoted : undefined,
    status: "PAUSED" as const,
  });
}
