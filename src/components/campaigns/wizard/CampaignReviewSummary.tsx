"use client";

import { Button } from "@/components/ui/button";
import type { CampaignQuestionnaireAnswers, ResolvedCampaignPlan } from "@/types/campaign-questionnaire";
import { formatTargetLocations } from "@/utils/wizard-location";

type CampaignReviewSummaryProps = {
  plan: ResolvedCampaignPlan;
  answers: CampaignQuestionnaireAnswers;
  pageName?: string;
  instagramLabel?: string;
  validationErrors: string[];
  onAcceptFallback: () => void;
  onRejectFallback: () => void;
};

function pixelStatusLabel(plan: ResolvedCampaignPlan): string {
  switch (plan.pixelResolution.status) {
    case "available":
      return plan.pixelResolution.pixelName;
    case "not_required":
      return "Kullanılmıyor";
    case "missing_fallback_available":
      return "Kullanılmıyor (trafik fallback)";
    case "missing_blocking":
      return "Eksik";
    default:
      return "—";
  }
}

export function CampaignReviewSummary({
  plan,
  answers,
  pageName,
  instagramLabel,
  validationErrors,
  onAcceptFallback,
  onRejectFallback,
}: CampaignReviewSummaryProps) {
  const needsFallbackApproval =
    plan.pixelResolution.status === "missing_fallback_available" &&
    !answers.salesTrafficFallbackAccepted;

  const showWebsiteUrl =
    plan.creative.destinationUrl &&
    (plan.effectiveRecipeId === "TRAFFIC_WEBSITE" ||
      plan.effectiveRecipeId === "SALES_WEBSITE" ||
      plan.effectiveRecipeId === "LEAD_WEBSITE");

  return (
    <div className="space-y-4">
      {!plan.recipeEnabled && (
        <p className="text-sm text-amber-700 dark:text-amber-300">Bu tür henüz aktif değil.</p>
      )}

      {validationErrors.map((e) => (
        <p key={e} className="text-sm text-destructive">
          {e}
        </p>
      ))}

      {needsFallbackApproval && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          <p className="text-foreground">
            Bu reklam hesabında Pixel/Dataset bulunamadığı için reklam satın alma dönüşümleri
            yerine web sitesi ziyaretlerine göre optimize edilecek.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onAcceptFallback}>
              Web sitesi trafiği olarak devam et
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onRejectFallback}>
              Geri dön
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm grid gap-3 sm:grid-cols-2">
        <div>
          <span className="text-muted-foreground">İşletme hedefi:</span>
          <p className="font-medium">{plan.businessGoalLabel}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Reklam optimizasyonu:</span>
          <p className="font-medium">{plan.performanceGoalLabel}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Dönüşüm yeri:</span>
          <p className="font-medium">{plan.conversionDestinationLabel}</p>
        </div>
        {showWebsiteUrl && (
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">Website URL:</span>
            <p className="font-medium break-all">{plan.creative.destinationUrl}</p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Hedef konum:</span>
          <p className="font-medium">{formatTargetLocations(plan.audience.locations)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Bütçe:</span>
          <p className="font-medium">{answers.dailyBudget} TL / gün</p>
        </div>
        <div>
          <span className="text-muted-foreground">CTA:</span>
          <p className="font-medium">{plan.creative.callToAction}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Facebook Sayfası:</span>
          <p className="font-medium">{pageName ?? answers.selectedAssets.page?.name ?? "—"}</p>
        </div>
        {instagramLabel && (
          <div>
            <span className="text-muted-foreground">Instagram:</span>
            <p className="font-medium">{instagramLabel}</p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Pixel:</span>
          <p className="font-medium">{pixelStatusLabel(plan)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Durum:</span>
          <p className="font-medium">Duraklatıldı</p>
        </div>
      </div>
    </div>
  );
}
