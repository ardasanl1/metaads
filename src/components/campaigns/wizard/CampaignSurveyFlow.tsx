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
  SelectedMetaLocation,
} from "@/types/campaign-questionnaire";
import type { WizardCreateStep, WizardGender, WizardSpecialAdCategory } from "@/types/campaign-wizard";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { useAccountSnapshot } from "@/hooks/use-account-snapshot";
import { useAdAccountProfile } from "@/hooks/use-ad-account-profile";
import {
  buildSurveyFlow,
  BUSINESS_GOAL_OPTIONS,
  canProceedFromQuestion,
  getDestinationLabel,
  resolveRecipeFromAnswers,
} from "@/services/campaign-questionnaire-engine";
import {
  questionnaireToCampaignDraft,
  resolveCampaignPlan,
  validateResolvedCampaignPlan,
} from "@/services/campaign-planner";
import { runRecipeWizard, uploadAdImage } from "@/services/meta/client";
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
import { MetaAssetsSection } from "@/components/campaign-wizard/MetaAssetsSection";
import { isFacebookHostname } from "@/utils/url-normalize";

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
  const [metaLoc, setMetaLoc] = useState<MetaLocationOption | null>(null);

  const recipeId = useMemo(() => resolveRecipeFromAnswers(answers), [answers]);
  const flow = useMemo(() => buildSurveyFlow(answers), [answers]);
  const q = flow[idx];
  const plan = useMemo(() => resolveCampaignPlan(answers), [answers]);
  const validation = useMemo(() => validateResolvedCampaignPlan(plan), [plan]);
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
    setAnswers((a) => ({ ...a, selectedAssets: snap.selectedAssets }));
  }, [snap.selectedAssets]);

  useEffect(() => {
    if (!accountProfile.discovery) return;
    snap.setSelectedAssets((current) => accountProfile.applyToSelectedAssets(current));
    if (accountProfile.defaultWebsiteUrl && !isFacebookHostname(accountProfile.defaultWebsiteUrl)) {
      setAnswers((a) => {
        if (a.creative.destinationUrl?.trim()) return a;
        return { ...a, creative: { ...a.creative, destinationUrl: accountProfile.defaultWebsiteUrl } };
      });
    }
  }, [accountProfile.discovery, accountProfile.defaultWebsiteUrl, accountProfile.applyToSelectedAssets, snap.setSelectedAssets]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    setIdx((current) => {
      if (flow.length === 0) return 0;
      if (current >= flow.length) return flow.length - 1;
      return current;
    });
  }, [flow.length]);

  const canProceed = q ? canProceedFromQuestion(q.id, answers) : false;

  function goNext() {
    if (!q) return;
    if (!canProceedFromQuestion(q.id, answers)) {
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

  const isOAuth = activeConnection?.authMethod === "oauth";
  const needsMetaSetup =
    isOAuth &&
    activeConnection &&
    !activeConnection.onboardingCompleted;

  if (!accountLoading && needsMetaSetup) {
    return (
      <SectionCard
        title="Meta hesap kurulumu gerekli"
        description="Kampanya oluşturmadan önce işletme, reklam hesabı, sayfa ve pixel seçimlerini bir kez tamamlayın."
      >
        <Button asChild>
          <a href="/settings/meta-setup">Hesap Kurulumuna Git</a>
        </Button>
      </SectionCard>
    );
  }

  const patch = (p: Partial<CampaignQuestionnaireAnswers>) => setAnswers((a) => ({ ...a, ...p }));

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

  async function onCreate() {
    if (!plan || !validation.valid) {
      toast.error(validation.errors[0] ?? "Plan eksik");
      return;
    }
    const hash = answers.creative.media[0]?.imageHash;
    if (!hash) return toast.error("Gorsel yukleyin");
    setSubmitting(true);
    setCreateStep("create_campaign");
    try {
      const result = await runRecipeWizard(questionnaireToCampaignDraft(answers, plan, hash));
      if (!result.success) return toast.error(result.message);
      toast.success(result.message);
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
                onClick={() => { patch({ businessGoal: o.id, conversionDestination: "", desiredResult: "", followUpAnswers: {} }); setIdx(1); }}>
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
            <MetaLocationAutocomplete label="Konum" placeholder="Konum ara" value={metaLoc}
              onSelect={(loc) => {
                setMetaLoc(loc);
                if (!loc) return patch({ audience: { ...answers.audience, locations: [] } });
                const sel: SelectedMetaLocation = { key: loc.key, type: loc.type, displayName: loc.displayName, countryCode: loc.countryCode };
                patch({ audience: { ...answers.audience, locations: [sel] } });
                snap.setSelectedAssets((c) => ({ ...c, location: { key: loc.key, type: loc.type, displayName: loc.displayName, countryCode: loc.countryCode } }));
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
                snap.setSelectedAssets((c) => ({ ...c, page: { id, name } }));
                void snap.reloadPageBound(id, name);
              }}
              onSelectPixel={(id, name) => {
                snap.setSelectedAssets((c) => ({ ...c, pixel: { id, name } }));
              }}
              onWebsiteChange={(url) => {
                patch({ creative: { ...answers.creative, destinationUrl: url } });
              }}
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
                onChange={(e) => patch({ creative: { ...answers.creative, destinationUrl: e.target.value } })} /></div>
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
            {!plan.recipeEnabled && <p className="text-sm text-amber-700 dark:text-amber-300">Bu tür henüz aktif değil.</p>}
            {validation.errors.map((e) => <p key={e} className="text-sm text-destructive">{e}</p>)}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm grid gap-2 sm:grid-cols-2">
              <div><span className="text-muted-foreground">Sonuç:</span> {recipe?.outcomeLabel}</div>
              <div><span className="text-muted-foreground">Yer:</span> {answers.conversionDestination ? getDestinationLabel(answers.conversionDestination) : "—"}</div>
              <div><span className="text-muted-foreground">Bütçe:</span> {answers.dailyBudget} TL</div>
              <div><span className="text-muted-foreground">Konum:</span> {answers.audience.locations[0]?.displayName ?? "—"}</div>
              <div><span className="text-muted-foreground">CTA:</span> {plan.creative.callToAction}</div>
              <div><span className="text-muted-foreground">Durum:</span> Duraklatıldı</div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setShowTech((v) => !v)}>
              {showTech ? "Teknik detayı gizle" : "Teknik detay"}
            </Button>
            {showTech && (
              <details open className="text-xs text-muted-foreground rounded-lg border border-border/60 p-3">
                <summary className="cursor-pointer font-medium text-foreground">Teknik ayarlar</summary>
                <div className="mt-2 space-y-1">
                  <div>Objective: {plan.campaign.objective}</div>
                  <div>Optimization: {plan.adSet.optimizationGoal}</div>
                  <div>Billing: {plan.adSet.billingEvent}</div>
                </div>
              </details>
            )}
            {createStep && <p className="text-sm text-muted-foreground">{CREATE_LABELS[createStep]}</p>}
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
            disabled={submitting || !validation.valid || !plan?.recipeEnabled}
            onClick={() => void onCreate()}
          >
            {submitting ? "Oluşturuluyor..." : "Onayla ve Oluştur"}
          </Button>
        )}
      </WizardFooter>
    </div>
  );
}
