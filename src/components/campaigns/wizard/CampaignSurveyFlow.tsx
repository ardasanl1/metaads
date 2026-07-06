"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CampaignRecipeId } from "@/config/campaign-recipes";
import { getCampaignRecipe } from "@/config/campaign-recipes";
import type {
  CampaignQuestionnaireAnswers,
  ConversionDestinationId,
  DesiredResultId,
} from "@/types/campaign-questionnaire";
import type { CampaignCreationResult, WizardCreateStep, WizardGender, WizardSpecialAdCategory, WizardOrchestrationResume } from "@/types/campaign-wizard";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { useAccountSnapshot } from "@/hooks/use-account-snapshot";
import { useAdAccountProfile } from "@/hooks/use-ad-account-profile";
import {
  buildSurveyFlow,
  BUSINESS_GOAL_OPTIONS,
  canProceedFromQuestion,
  resolveRecipeFromAnswers,
} from "@/services/campaign-questionnaire-engine";
import {
  questionnaireToCampaignDraft,
  resolveCampaignPlan,
  validateResolvedCampaignPlan,
} from "@/services/campaign-planner";
import { createFullAdCampaignPlan, uploadAdImage } from "@/services/meta/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetaLocationAutocomplete } from "@/components/locations/MetaLocationAutocomplete";
import type { MetaLocationOption } from "@/types/meta-assets";
import { AssetPicker, ChoiceCard, ImagePreview } from "./survey-ui";
import { SectionCard } from "@/components/shared/SectionCard";
import { WizardProgress, questionToProgressStep } from "@/components/campaign-wizard/WizardProgress";
import { CompactTipsPanel } from "@/components/campaign-wizard/CompactTipsPanel";
import { WizardFooter } from "@/components/campaign-wizard/WizardFooter";
import { CampaignReviewSummary } from "@/components/campaigns/wizard/CampaignReviewSummary";
import { MetaAssetsSection } from "@/components/campaign-wizard/MetaAssetsSection";
import { isFacebookHostname, isAllowedWebsiteUrl, isBlockedWebsiteUrl, normalizeWebsiteUrl } from "@/utils/url-normalize";
import { recipeRequiresWebsiteUrl } from "@/utils/recipe-pixel";
import { metaLocationToSelected, selectedToMetaLocationOption } from "@/utils/wizard-location";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

const CREATE_LABELS: Record<WizardCreateStep, string> = {
  upload_image: "Gorsel yukleniyor",
  create_campaign: "Kampanya olusturuluyor",
  create_adset: "Reklam seti olusturuluyor",
  create_creative: "Creative olusturuluyor",
  create_ad: "Reklam olusturuluyor",
};

function defaultAnswers(): CampaignQuestionnaireAnswers {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    businessGoal: "",
    conversionDestination: "",
    desiredResult: "",
    dailyBudget: 250,
    startDate: iso,
    audience: { locations: [], ageMin: 18, ageMax: 65, genders: ["ALL"] },
    creative: { media: [{ file: null, format: "image" }], primaryText: "", headline: "" },
    specialAdCategoryConfirmed: false,
    specialAdCategories: ["NONE"],
    followUpAnswers: {},
    selectedAssets: {},
  };
}

export function CampaignSurveyFlow() {
  const router = useRouter();
  const { isReady, status, loading: accountLoading, activeConnectionId, activeConnection, selectedAdAccountId } =
    useMetaAccount();

  const [answers, setAnswers] = useState(defaultAnswers);
  const [idx, setIdx] = useState(0);
  const [showTech, setShowTech] = useState(false);
  const [catYes, setCatYes] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createStep, setCreateStep] = useState<WizardCreateStep | null>(null);
  const [creationResult, setCreationResult] = useState<CampaignCreationResult | null>(null);
  const [resume, setResume] = useState<WizardOrchestrationResume | null>(null);
  const [metaLoc, setMetaLoc] = useState<MetaLocationOption | null>(null);

  const recipeId = useMemo(() => resolveRecipeFromAnswers(answers), [answers]);
  const flow = useMemo(() => buildSurveyFlow(answers), [answers]);
  const q = flow[idx];
  const plan = useMemo(() => resolveCampaignPlan(answers), [answers]);
  const validation = useMemo(() => validateResolvedCampaignPlan(plan), [plan]);
  const needsFallbackApproval = Boolean(
    plan?.pixelResolution.status === "missing_fallback_available" &&
      !answers.salesTrafficFallbackAccepted,
  );
  const canCreate =
    Boolean(validation.valid && plan?.recipeEnabled && !needsFallbackApproval);
  const recipe = recipeId ? getCampaignRecipe(recipeId) : null;

  const snap = useAccountSnapshot({
    connectionId: activeConnectionId ?? undefined,
    businessId: activeConnection?.metaBusinessId ?? undefined,
    adAccountId: selectedAdAccountId ?? undefined,
    recipeId: recipeId as CampaignRecipeId | null,
    pageId: answers.selectedAssets.page?.id,
  });

  const accountProfile = useAdAccountProfile({
    connectionId: activeConnectionId ?? undefined,
    businessId: activeConnection?.metaBusinessId ?? undefined,
    adAccountId: selectedAdAccountId ?? undefined,
    recipeId: recipeId as CampaignRecipeId | null,
    authMethod: activeConnection?.authMethod,
    onboardingCompleted: activeConnection?.onboardingCompleted,
  });

  useEffect(() => {
    const loc = answers.audience.locations[0];
    if (loc) {
      setMetaLoc(selectedToMetaLocationOption(loc));
    }
  }, [answers.audience.locations]);

  useEffect(() => {
    if (!accountProfile.discovery) return;
    setAnswers((a) => {
      const mergedAssets = accountProfile.applyToSelectedAssets(a.selectedAssets);
      if (
        mergedAssets.page?.id === a.selectedAssets.page?.id &&
        mergedAssets.pixel?.id === a.selectedAssets.pixel?.id &&
        mergedAssets.instagram?.id === a.selectedAssets.instagram?.id
      ) {
        return a;
      }
      return { ...a, selectedAssets: mergedAssets };
    });
    snap.setSelectedAssets((current) => accountProfile.applyToSelectedAssets(current));
    if (
      accountProfile.defaultWebsiteUrl &&
      !isFacebookHostname(accountProfile.defaultWebsiteUrl) &&
      !isBlockedWebsiteUrl(accountProfile.defaultWebsiteUrl)
    ) {
      setAnswers((a) => {
        if (a.creative.destinationUrl?.trim()) return a;
        return { ...a, creative: { ...a.creative, destinationUrl: accountProfile.defaultWebsiteUrl } };
      });
    }
  }, [accountProfile.discovery, accountProfile.defaultWebsiteUrl, accountProfile.applyToSelectedAssets, snap.setSelectedAssets]);

  useEffect(() => {
    setAnswers((a) => {
      const merged = { ...a.selectedAssets, ...snap.selectedAssets };
      if (JSON.stringify(merged) === JSON.stringify(a.selectedAssets)) return a;
      return { ...a, selectedAssets: merged };
    });
  }, [snap.selectedAssets]);

  const answersForValidation = useMemo(() => {
    if (!accountProfile.discovery) return answers;
    return {
      ...answers,
      selectedAssets: accountProfile.applyToSelectedAssets(answers.selectedAssets),
    };
  }, [answers, accountProfile.discovery, accountProfile.applyToSelectedAssets]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    setIdx((current) => {
      if (flow.length === 0) return 0;
      if (current >= flow.length) return flow.length - 1;
      return current;
    });
  }, [flow.length]);

  const canProceed = q ? canProceedFromQuestion(q.id, answersForValidation) : false;

  function goNext() {
    if (!q) return;
    if (!canProceedFromQuestion(q.id, answersForValidation)) {
      if (q.id === "assets") {
        const recipe = recipeId ? getCampaignRecipe(recipeId) : null;
        const assets = answersForValidation.selectedAssets;
        if (recipe?.requiredAssets.includes("page") && !assets.page?.id) {
          toast.error("Facebook Sayfası seçilmedi veya henüz yüklenmedi");
          return;
        }
        if (
          recipe?.requiredAssets.includes("pixel") &&
          !assets.pixel?.id &&
          recipeId !== "SALES_WEBSITE"
        ) {
          toast.error("Bu kampanya türü için Pixel gerekli");
          return;
        }
        if (
          recipeId &&
          recipeRequiresWebsiteUrl(recipeId) &&
          !isAllowedWebsiteUrl(answersForValidation.creative.destinationUrl)
        ) {
          toast.error("Geçerli bir Website URL girin");
          return;
        }
      }
      toast.error("Devam etmek için bu adımı tamamlayın");
      return;
    }
    setIdx((i) => Math.min(flow.length - 1, i + 1));
  }

  function goBack() {
    setIdx((i) => Math.max(0, i - 1));
  }

  if (!accountLoading && status && !status.connected) {
    return (
      <SectionCard title="Meta bağlantısı gerekli" description="Kampanya oluşturmak için önce Meta hesabınızı bağlayın.">
        <Button asChild>
          <a href="/settings">Ayarlara Git</a>
        </Button>
      </SectionCard>
    );
  }
  if (!accountLoading && status?.connected && !isReady) {
    return (
      <SectionCard title="Reklam hesabı seçin" description="Devam etmek için bir reklam hesabı seçin.">
        <Button asChild variant="outline">
          <a href="/settings">Ayarlara Git</a>
        </Button>
      </SectionCard>
    );
  }

  const patch = (p: Partial<CampaignQuestionnaireAnswers>) => setAnswers((a) => ({ ...a, ...p }));

  function patchWebsiteUrl(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      patch({ creative: { ...answers.creative, destinationUrl: "" } });
      return;
    }
    const normalized = normalizeWebsiteUrl(trimmed);
    patch({ creative: { ...answers.creative, destinationUrl: normalized ?? trimmed } });
  }

  async function onImage(file: File | null) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      toast.error("Gecersiz gorsel");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const { imageHash } = await uploadAdImage(file);
      const media = [{ file, imageHash, format: "image" as const }];
      patch({ creative: { ...answers.creative, media } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yukleme hatasi");
    } finally {
      setUploading(false);
    }
  }

  async function onCreate(fromRetry = false) {
    if (!plan) return;
    if (needsFallbackApproval) {
      toast.error("Devam etmek için trafik fallback planını onaylayın");
      return;
    }
    if (!validation.valid) {
      toast.error(validation.errors[0] ?? "Plan eksik");
      return;
    }
    const hash = answers.creative.media[0]?.imageHash;
    if (!hash) return toast.error("Gorsel yukleyin");
    setSubmitting(true);
    setCreateStep("create_campaign");
    setCreationResult(null);
    try {
      const draft = {
        ...questionnaireToCampaignDraft(answers, plan, hash),
        ...(fromRetry && resume?.campaignId ? { resume } : {}),
      };
      const result = await createFullAdCampaignPlan(draft);
      setCreationResult(result);

      if (!result.success) {
        if (result.campaignId) {
          setResume({
            campaignId: result.campaignId,
            adSetId: result.adSetId,
            creativeId: result.creativeId,
            failedStep: result.failedStepLegacy ?? undefined,
          });
        }
        toast.error(result.message);
        return;
      }

      setResume(null);
      toast.success("Reklam zinciri oluşturuldu (Campaign + Ad Set + Creative + Ad)");
      if (result.campaignId) router.push(`/campaigns/${result.campaignId}`);
    } finally {
      setSubmitting(false);
      setCreateStep(null);
    }
  }

  const progressStep = questionToProgressStep(q?.id);

  return (
    <div className="mx-auto max-w-[1280px] pb-20">
      <WizardProgress activeStep={progressStep} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:gap-8">
        <div className="min-w-0 rounded-xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-start justify-between gap-3 border-b border-border/50 pb-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {q?.title ?? "Reklam Anketi"}
              </h2>
              {q?.description && (
                <p className="mt-1 text-sm text-muted-foreground">{q.description}</p>
              )}
            </div>
            <Badge variant="secondary" className="shrink-0 font-normal">
              Soru {idx + 1}/{flow.length}
            </Badge>
          </div>

          <div className="space-y-4">
      {q?.id === "business_goal" && (
        <div className="grid gap-2">
            {BUSINESS_GOAL_OPTIONS.map((o) => (
              <Button key={o.id} variant="outline" className="h-auto justify-start border-border/60 py-3 text-left font-normal shadow-none hover:bg-muted/50"
                onClick={() => {
                  patch({
                    businessGoal: o.id,
                    conversionDestination: "",
                    desiredResult: "",
                    followUpAnswers: {},
                    salesTrafficFallbackAccepted: false,
                  });
                  setIdx(1);
                }}>
                {o.label}
              </Button>
            ))}
        </div>
      )}

      {q?.id === "lead_collection_method" && (
        <ChoiceCard options={q.options ?? []} onSelect={(id) => {
          patch({ followUpAnswers: { ...answers.followUpAnswers, lead_collection_method: id }, conversionDestination: id as ConversionDestinationId });
          setIdx((i) => i + 1);
        }} />
      )}

      {q?.id === "conversion_destination" && (
        <ChoiceCard options={q.options ?? []} onSelect={(id) => {
          patch({ conversionDestination: id as ConversionDestinationId }); setIdx((i) => i + 1);
        }} />
      )}

      {q?.id === "desired_result" && (
        <ChoiceCard options={q.options ?? []} onSelect={(id) => {
          patch({ desiredResult: id as DesiredResultId }); setIdx((i) => i + 1);
        }} />
      )}

      {q?.id === "video_priority" && (
        <ChoiceCard options={q.options ?? []} onSelect={(id) => {
          patch({
            followUpAnswers: { ...answers.followUpAnswers, video_priority: id },
            desiredResult: id === "reach" ? "reach" : "video_view",
          });
          setIdx((i) => i + 1);
        }} />
      )}

      {q?.id === "budget" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5"><Label>Günlük bütçe (TL)</Label>
              <Input type="number" value={answers.dailyBudget} onChange={(e) => patch({ dailyBudget: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Başlangıç</Label><Input type="date" value={answers.startDate} onChange={(e) => patch({ startDate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Bitiş</Label><Input type="date" value={answers.endDate ?? ""} onChange={(e) => patch({ endDate: e.target.value })} /></div>
          </div>
      )}

      {q?.id === "audience" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
            <MetaLocationAutocomplete label="Hedef konum" placeholder="Şehir, bölge veya ülke ara" value={metaLoc}
              onSelect={(loc) => {
                setMetaLoc(loc);
                if (!loc) {
                  return patch({ audience: { ...answers.audience, locations: [] } });
                }
                patch({
                  audience: {
                    ...answers.audience,
                    locations: [metaLocationToSelected(loc)],
                  },
                });
              }}
              connectionId={activeConnectionId ?? undefined} minChars={2} />
            </div>
            <div className="space-y-1.5"><Label>Min yaş</Label><Input type="number" value={answers.audience.ageMin}
              onChange={(e) => patch({ audience: { ...answers.audience, ageMin: Number(e.target.value) } })} /></div>
            <div className="space-y-1.5"><Label>Max yaş</Label><Input type="number" value={answers.audience.ageMax}
              onChange={(e) => patch({ audience: { ...answers.audience, ageMax: Number(e.target.value) } })} /></div>
            <div className="space-y-1.5"><Label>Cinsiyet</Label>
              <Select value={answers.audience.genders[0] ?? "ALL"} onValueChange={(v) => patch({ audience: { ...answers.audience, genders: [v as WizardGender] } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tümü</SelectItem><SelectItem value="MALE">Erkek</SelectItem><SelectItem value="FEMALE">Kadın</SelectItem>
                </SelectContent>
              </Select></div>
          </div>
      )}

      {q?.id === "assets" && recipe && (
          <div className="space-y-4">
            <MetaAssetsSection
              discovery={accountProfile.discovery}
              loading={accountProfile.loading}
              needsManualForm={accountProfile.needsManualForm}
              authMethod={activeConnection?.authMethod}
              profileError={accountProfile.error}
              pageOptions={accountProfile.pageOptions}
              pixelOptions={accountProfile.pixelOptions}
              websiteOptions={accountProfile.websiteOptions}
              required={accountProfile.required}
              selectedPageId={answers.selectedAssets.page?.id}
              selectedPageName={answers.selectedAssets.page?.name}
              selectedPixelId={answers.selectedAssets.pixel?.id}
              selectedPixelName={answers.selectedAssets.pixel?.name}
              websiteUrl={answers.creative.destinationUrl ?? ""}
              onSelectPage={(id, name) => {
                const next = { page: { id, name }, instagram: undefined as undefined };
                snap.setSelectedAssets((c) => ({ ...c, ...next }));
                setAnswers((a) => ({
                  ...a,
                  selectedAssets: { ...a.selectedAssets, ...next },
                }));
                void snap.reloadPageBound(id, name);
              }}
              onSelectPixel={(id, name) => {
                snap.setSelectedAssets((c) => ({ ...c, pixel: { id, name } }));
                setAnswers((a) => ({
                  ...a,
                  selectedAssets: { ...a.selectedAssets, pixel: { id, name } },
                }));
              }}
              onWebsiteChange={patchWebsiteUrl}
              onSaveManual={async (manual) => {
                await accountProfile.saveManual(manual);
                if (manual.websiteUrl && !isFacebookHostname(manual.websiteUrl)) {
                  patch({ creative: { ...answers.creative, destinationUrl: manual.websiteUrl } });
                }
                toast.success("Hesap profili kaydedildi");
              }}
              onRescan={() => void accountProfile.reload()}
            />
            {recipe.requiredAssets.includes("instantForm") && (
              <AssetPicker label="Meta Form" value={answers.selectedAssets.instantForm?.id ?? ""}
                options={(snap.snapshot?.instantForms ?? []).map((f) => ({ id: f.id, label: f.name }))}
                onChange={(id) => {
                  const f = snap.snapshot?.instantForms.find((x) => x.id === id);
                  snap.setSelectedAssets((c) => ({ ...c, instantForm: f ? { id: f.id, name: f.name } : undefined }));
                }} />
            )}
            {recipe.requiredAssets.includes("whatsapp") && (
              <AssetPicker label="WhatsApp" value={answers.selectedAssets.whatsapp?.id ?? ""}
                options={(snap.snapshot?.whatsappAccounts ?? []).map((w) => ({ id: w.id, label: w.name }))}
                onChange={(id) => {
                  const w = snap.snapshot?.whatsappAccounts.find((x) => x.id === id);
                  snap.setSelectedAssets((c) => ({ ...c, whatsapp: w ? { id: w.id, name: w.name } : undefined }));
                }} />
            )}
          </div>
      )}

      {q?.id === "creative" && (
          <div className="space-y-4">
            {recipe?.requiredUserFields.includes("websiteUrl") && (
              <div className="space-y-1.5"><Label>Website URL</Label><Input type="url" placeholder="https://ornek.com/urun" value={answers.creative.destinationUrl ?? ""}
                onChange={(e) => patchWebsiteUrl(e.target.value)} /></div>
            )}
            <div className="space-y-1.5">
              <Label>Görsel</Label>
              <Input type="file" accept="image/*" disabled={uploading}
              onChange={(e) => void onImage(e.target.files?.[0] ?? null)} />
              <ImagePreview url={preview} />
            </div>
            <div className="space-y-1.5"><Label>Reklam metni</Label><Input value={answers.creative.primaryText}
              onChange={(e) => patch({ creative: { ...answers.creative, primaryText: e.target.value } })} /></div>
            <div className="space-y-1.5"><Label>Başlık</Label><Input value={answers.creative.headline}
              onChange={(e) => patch({ creative: { ...answers.creative, headline: e.target.value } })} /></div>
          </div>
      )}

      {q?.id === "special_category" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={catYes === false ? "default" : "outline"} onClick={() => { setCatYes(false); patch({ specialAdCategoryConfirmed: true, specialAdCategories: ["NONE"] }); }}>Hayır</Button>
              <Button variant={catYes === true ? "default" : "outline"} onClick={() => { setCatYes(true); patch({ specialAdCategoryConfirmed: true }); }}>Evet</Button>
            </div>
            {catYes && (
              <Select value={answers.specialAdCategories[0]} onValueChange={(v) => patch({ specialAdCategories: [v as WizardSpecialAdCategory] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYMENT">İstihdam</SelectItem>
                  <SelectItem value="HOUSING">Konut</SelectItem>
                  <SelectItem value="CREDIT">Kredi</SelectItem>
                  <SelectItem value="FINANCIAL_PRODUCTS_SERVICES">Finansal</SelectItem>
                  <SelectItem value="ISSUES_ELECTIONS_POLITICS">Sosyal/Politik</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
      )}

      {q?.id === "review" && plan && (
          <div className="space-y-4">
            <CampaignReviewSummary
              plan={plan}
              answers={answers}
              pageName={answers.selectedAssets.page?.name ?? accountProfile.discovery?.profile.page?.name}
              instagramLabel={
                answers.selectedAssets.instagram?.username
                  ? `@${answers.selectedAssets.instagram.username}`
                  : accountProfile.discovery?.profile.instagram?.username
                    ? `@${accountProfile.discovery.profile.instagram.username}`
                    : undefined
              }
              validationErrors={validation.errors}
              onAcceptFallback={() => patch({ salesTrafficFallbackAccepted: true })}
              onRejectFallback={() => {
                patch({ salesTrafficFallbackAccepted: false });
                const assetsIdx = flow.findIndex((step) => step.id === "assets");
                if (assetsIdx >= 0) setIdx(assetsIdx);
              }}
            />
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setShowTech((v) => !v)}>
              {showTech ? "Teknik detayı gizle" : "Teknik detay"}
            </Button>
            {showTech && (
              <details open className="text-xs text-muted-foreground rounded-lg border border-border/60 p-3">
                <summary className="cursor-pointer font-medium text-foreground">Teknik ayarlar</summary>
                <div className="mt-2 space-y-1">
                  <div>Recipe: {plan.effectiveRecipeId}</div>
                  <div>Objective: {plan.campaign.objective}</div>
                  <div>Optimization: {plan.adSet.optimizationGoal}</div>
                  <div>Billing: {plan.adSet.billingEvent}</div>
                  <div>Targeting: {JSON.stringify(plan.adSet.targeting)}</div>
                  {creationResult?.debug && (
                    <>
                      <div className="mt-2">Bütçe: {creationResult.debug.dailyBudgetUi} TRY → {creationResult.debug.dailyBudgetSent}</div>
                      <div>Objective (oluşan): {creationResult.debug.campaignObjective}</div>
                      {creationResult.debug.adSetPayload && (
                        <div>Ad Set payload: {JSON.stringify(creationResult.debug.adSetPayload)}</div>
                      )}
                    </>
                  )}
                </div>
              </details>
            )}
            {createStep && <p className="text-sm text-muted-foreground">{CREATE_LABELS[createStep]}</p>}
            {creationResult && (
              <div className="rounded-lg border border-border/60 p-3 text-sm space-y-1">
                <p className="font-medium text-foreground">Oluşturma durumu</p>
                {creationResult.debug?.steps.map((step) => {
                  const labels: Record<string, string> = {
                    media_upload: "Medya",
                    campaign: "Campaign",
                    adset: "Ad Set",
                    creative: "Creative",
                    ad: "Ad",
                  };
                  const statusLabels: Record<string, string> = {
                    success: "oluşturuldu",
                    failed: "oluşturulamadı",
                    skipped: "atlandı",
                    not_started: "başlatılmadı",
                  };
                  return (
                    <div key={step.step} className={step.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                      {labels[step.step] ?? step.step}: {statusLabels[step.status] ?? step.status}
                      {step.entityId ? ` (${step.entityId})` : ""}
                    </div>
                  );
                })}
                {creationResult.metaError && (
                  <p className="text-destructive text-xs mt-2">
                    Meta: {creationResult.metaError.userTitle ?? creationResult.metaError.message}
                    {creationResult.metaError.subcode ? ` [${creationResult.metaError.code}/${creationResult.metaError.subcode}]` : ""}
                  </p>
                )}
                {!creationResult.success && resume?.campaignId && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => void onCreate(true)}>
                      Kaldığı yerden devam et
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setResume(null)}>
                      Yeni baştan
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
      )}
          </div>
        </div>

        <div className="order-last lg:order-none">
          <CompactTipsPanel />
        </div>
      </div>

      <WizardFooter>
        <Button variant="outline" disabled={idx === 0} onClick={goBack}>
          Geri
        </Button>
        {q?.id !== "review" ? (
          <Button disabled={!canProceed} onClick={goNext}>
            Devam Et
          </Button>
        ) : (
          <Button
            disabled={submitting || !canCreate}
            onClick={() => void onCreate()}
          >
            {submitting ? "Oluşturuluyor..." : "Onayla ve Oluştur"}
          </Button>
        )}
      </WizardFooter>
    </div>
  );
}
