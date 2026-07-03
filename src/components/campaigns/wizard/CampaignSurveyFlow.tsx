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
import { AccountProfilePanel } from "./AccountProfilePanel";
import {
  buildSurveyFlow,
  BUSINESS_GOAL_OPTIONS,
  getDestinationLabel,
  resolveRecipeFromAnswers,
} from "@/services/campaign-questionnaire-engine";
import {
  questionnaireToCampaignDraft,
  resolveCampaignPlan,
  validateResolvedCampaignPlan,
} from "@/services/campaign-planner";
import { runRecipeWizard, uploadAdImage } from "@/services/meta/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { WizardStepper } from "@/components/campaign-wizard/WizardStepper";
import { WizardTipsPanel } from "@/components/campaign-wizard/WizardTipsPanel";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { Info } from "lucide-react";

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
  });

  useEffect(() => {
    setAnswers((a) => ({ ...a, selectedAssets: snap.selectedAssets }));
  }, [snap.selectedAssets]);

  useEffect(() => {
    if (!accountProfile.discovery) return;
    snap.setSelectedAssets((current) => accountProfile.applyToSelectedAssets(current));
    if (accountProfile.defaultWebsiteUrl) {
      setAnswers((a) => {
        if (a.creative.destinationUrl?.trim()) return a;
        return { ...a, creative: { ...a.creative, destinationUrl: accountProfile.defaultWebsiteUrl } };
      });
    }
  }, [accountProfile.discovery, accountProfile.defaultWebsiteUrl, accountProfile.applyToSelectedAssets, snap.setSelectedAssets]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

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

  return (
    <div className="space-y-6 pb-24">
      <WizardStepper currentStep={idx + 1} totalSteps={flow.length} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4">
          <SectionCard
            title="Reklam Anketi"
            description={`${recipe?.outcomeLabel ?? "İş dilinizde birkaç soru"} · Soru ${idx + 1} / ${flow.length}`}
          >
            <div className="mb-4 flex gap-3 rounded-xl border border-primary/20 bg-accent/50 p-4 text-sm text-accent-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Her adımda yanıtlarınız kampanya planını otomatik oluşturur. İstediğiniz zaman geri dönebilirsiniz.</p>
            </div>

      {q?.id === "business_goal" && (
        <Card>
          <CardHeader><CardTitle>{q.title}</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {BUSINESS_GOAL_OPTIONS.map((o) => (
              <Button key={o.id} variant="outline" className="h-auto justify-start py-3 text-left"
                onClick={() => { patch({ businessGoal: o.id, conversionDestination: "", desiredResult: "", followUpAnswers: {} }); setIdx(1); }}>
                {o.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {q?.id === "lead_collection_method" && (
        <ChoiceCard title={q.title} options={q.options ?? []} onSelect={(id) => {
          patch({ followUpAnswers: { ...answers.followUpAnswers, lead_collection_method: id }, conversionDestination: id as ConversionDestinationId });
          setIdx((i) => i + 1);
        }} />
      )}

      {q?.id === "conversion_destination" && (
        <ChoiceCard title={q.title} options={q.options ?? []} onSelect={(id) => {
          patch({ conversionDestination: id as ConversionDestinationId }); setIdx((i) => i + 1);
        }} />
      )}

      {q?.id === "desired_result" && (
        <ChoiceCard title={q.title} options={q.options ?? []} onSelect={(id) => {
          patch({ desiredResult: id as DesiredResultId }); setIdx((i) => i + 1);
        }} />
      )}

      {q?.id === "video_priority" && (
        <ChoiceCard title={q.title} options={q.options ?? []} onSelect={(id) => {
          patch({
            followUpAnswers: { ...answers.followUpAnswers, video_priority: id },
            desiredResult: id === "reach" ? "reach" : "video_view",
          });
          setIdx((i) => i + 1);
        }} />
      )}

      {q?.id === "budget" && (
        <Card>
          <CardHeader><CardTitle>{q.title}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Gunluk butce (TL)</Label>
              <Input type="number" value={answers.dailyBudget} onChange={(e) => patch({ dailyBudget: Number(e.target.value) })} /></div>
            <div><Label>Baslangic</Label><Input type="date" value={answers.startDate} onChange={(e) => patch({ startDate: e.target.value })} /></div>
            <div><Label>Bitis</Label><Input type="date" value={answers.endDate ?? ""} onChange={(e) => patch({ endDate: e.target.value })} /></div>
          </CardContent>
        </Card>
      )}

      {q?.id === "audience" && (
        <Card>
          <CardHeader><CardTitle>{q.title}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <MetaLocationAutocomplete label="Konum" placeholder="Konum ara" value={metaLoc}
              onSelect={(loc) => {
                setMetaLoc(loc);
                if (!loc) return patch({ audience: { ...answers.audience, locations: [] } });
                const sel: SelectedMetaLocation = { key: loc.key, type: loc.type, displayName: loc.displayName, countryCode: loc.countryCode };
                patch({ audience: { ...answers.audience, locations: [sel] } });
                snap.setSelectedAssets((c) => ({ ...c, location: { key: loc.key, type: loc.type, displayName: loc.displayName, countryCode: loc.countryCode } }));
              }}
              connectionId={activeConnectionId ?? undefined} minChars={2} />
            <div><Label>Min yas</Label><Input type="number" value={answers.audience.ageMin}
              onChange={(e) => patch({ audience: { ...answers.audience, ageMin: Number(e.target.value) } })} /></div>
            <div><Label>Max yas</Label><Input type="number" value={answers.audience.ageMax}
              onChange={(e) => patch({ audience: { ...answers.audience, ageMax: Number(e.target.value) } })} /></div>
            <div><Label>Cinsiyet</Label>
              <Select value={answers.audience.genders[0] ?? "ALL"} onValueChange={(v) => patch({ audience: { ...answers.audience, genders: [v as WizardGender] } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tumu</SelectItem><SelectItem value="MALE">Erkek</SelectItem><SelectItem value="FEMALE">Kadin</SelectItem>
                </SelectContent>
              </Select></div>
          </CardContent>
        </Card>
      )}

      {q?.id === "assets" && recipe && (
        <Card>
          <CardHeader><CardTitle>{q.title}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <AccountProfilePanel
              discovery={accountProfile.discovery}
              loading={accountProfile.loading}
              needsManualForm={accountProfile.needsManualForm}
              pageOptions={accountProfile.pageOptions}
              pixelOptions={accountProfile.pixelOptions}
              websiteOptions={accountProfile.websiteOptions}
              required={accountProfile.required}
              selectedPageId={answers.selectedAssets.page?.id}
              selectedPixelId={answers.selectedAssets.pixel?.id}
              selectedWebsiteUrl={answers.creative.destinationUrl}
              onSelectPage={(id, name) => {
                snap.setSelectedAssets((c) => ({ ...c, page: { id, name } }));
                void snap.reloadPageBound(id, name);
              }}
              onSelectPixel={(id, name) => {
                snap.setSelectedAssets((c) => ({ ...c, pixel: { id, name } }));
              }}
              onSelectWebsite={(url) => {
                patch({ creative: { ...answers.creative, destinationUrl: url } });
              }}
              onSaveManual={async (manual) => {
                await accountProfile.saveManual(manual);
                toast.success("Hesap profili kaydedildi");
              }}
            />
            <Button size="sm" variant="outline" onClick={() => void accountProfile.reload()} disabled={accountProfile.loading}>
              Profili yenile
            </Button>
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
          </CardContent>
        </Card>
      )}

      {q?.id === "creative" && (
        <Card>
          <CardHeader><CardTitle>{q.title}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {recipe?.requiredUserFields.includes("websiteUrl") && (
              <div><Label>Website URL</Label><Input value={answers.creative.destinationUrl ?? ""}
                onChange={(e) => patch({ creative: { ...answers.creative, destinationUrl: e.target.value } })} /></div>
            )}
            <div><Label>Gorsel</Label><Input type="file" accept="image/*" disabled={uploading}
              onChange={(e) => void onImage(e.target.files?.[0] ?? null)} /><ImagePreview url={preview} /></div>
            <div><Label>Reklam metni</Label><Input value={answers.creative.primaryText}
              onChange={(e) => patch({ creative: { ...answers.creative, primaryText: e.target.value } })} /></div>
            <div><Label>Baslik</Label><Input value={answers.creative.headline}
              onChange={(e) => patch({ creative: { ...answers.creative, headline: e.target.value } })} /></div>
          </CardContent>
        </Card>
      )}

      {q?.id === "special_category" && (
        <Card>
          <CardHeader><CardTitle>{q.title}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant={catYes === false ? "default" : "outline"} onClick={() => { setCatYes(false); patch({ specialAdCategoryConfirmed: true, specialAdCategories: ["NONE"] }); }}>Hayir</Button>
              <Button variant={catYes === true ? "default" : "outline"} onClick={() => { setCatYes(true); patch({ specialAdCategoryConfirmed: true }); }}>Evet</Button>
            </div>
            {catYes && (
              <Select value={answers.specialAdCategories[0]} onValueChange={(v) => patch({ specialAdCategories: [v as WizardSpecialAdCategory] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYMENT">Istihdam</SelectItem>
                  <SelectItem value="HOUSING">Konut</SelectItem>
                  <SelectItem value="CREDIT">Kredi</SelectItem>
                  <SelectItem value="FINANCIAL_PRODUCTS_SERVICES">Finansal</SelectItem>
                  <SelectItem value="ISSUES_ELECTIONS_POLITICS">Sosyal/Politik</SelectItem>
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {q?.id === "review" && plan && (
        <Card>
          <CardHeader><CardTitle>Reklam plani ozeti</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!plan.recipeEnabled && <p className="text-sm text-yellow-800">Bu tur henuz aktif degil.</p>}
            {validation.errors.map((e) => <p key={e} className="text-sm text-destructive">{e}</p>)}
            <div className="rounded-lg border bg-muted/30 p-4 text-sm grid gap-2 sm:grid-cols-2">
              <div><b>Sonuc:</b> {recipe?.outcomeLabel}</div>
              <div><b>Yer:</b> {answers.conversionDestination ? getDestinationLabel(answers.conversionDestination) : "-"}</div>
              <div><b>Butce:</b> {answers.dailyBudget} TL</div>
              <div><b>Konum:</b> {answers.audience.locations[0]?.displayName ?? "-"}</div>
              <div><b>CTA:</b> {plan.creative.callToAction}</div>
              <div><b>Durum:</b> Duraklatildi</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowTech((v) => !v)}>
              {showTech ? "Teknik gizle" : "Teknik ayarlar"}
            </Button>
            {showTech && (
              <div className="text-xs text-muted-foreground border rounded p-3">
                <div>Objective: {plan.campaign.objective}</div>
                <div>Optimization: {plan.adSet.optimizationGoal}</div>
                <div>Billing: {plan.adSet.billingEvent}</div>
                <div>Promoted: {JSON.stringify(plan.adSet.promotedObject ?? {})}</div>
              </div>
            )}
            {createStep && <p className="text-sm">{CREATE_LABELS[createStep]}</p>}
          </CardContent>
        </Card>
      )}
          </SectionCard>
        </div>

        <div className="order-last lg:order-none">
          <WizardTipsPanel recipeLabel={recipe?.outcomeLabel} />
        </div>
      </div>

      <StickyActionBar className="[&>div]:max-w-none">
        <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          Geri
        </Button>
        {q?.id !== "review" ? (
          <Button className="flex-1" onClick={() => setIdx((i) => Math.min(flow.length - 1, i + 1))}>
            İleri
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={submitting || !validation.valid || !plan?.recipeEnabled}
            onClick={() => void onCreate()}
          >
            {submitting ? "Oluşturuluyor..." : "Onayla ve Oluştur"}
          </Button>
        )}
      </StickyActionBar>
    </div>
  );
}
