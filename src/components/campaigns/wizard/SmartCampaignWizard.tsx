"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CampaignRecipeId } from "@/config/campaign-recipes";
import { CAMPAIGN_RECIPES } from "@/config/campaign-recipes";
import type {
  CampaignDraft,
  CampaignSubmit,
  WizardCreateStep,
  WizardCtaChoice,
  WizardGender,
  WizardSpecialAdCategory,
  WizardStepId,
} from "@/types/campaign-wizard";
import { hasErrors, validateCampaignDraft } from "@/utils/campaign-wizard-validation";
import { formatPageOptionLabel } from "@/utils/meta-page";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { useAccountSnapshot } from "@/hooks/use-account-snapshot";
import {
  PRIMARY_GOAL_OPTIONS,
  resolveGoalSelection,
  type GoalOption,
} from "@/services/campaign-question-resolver";
import {
  applyRecipeDefaults,
  buildWizardPlan,
  generateCampaignName,
  getTechnicalSummary,
} from "@/services/campaign-planner";
import { runRecipeWizard, uploadAdImage } from "@/services/meta/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const CREATE_STEP_LABELS: Record<WizardCreateStep, string> = {
  upload_image: "Görsel yükleniyor",
  create_campaign: "Kampanya oluşturuluyor",
  create_adset: "Reklam seti oluşturuluyor",
  create_creative: "Creative oluşturuluyor",
  create_ad: "Reklam oluşturuluyor",
};

const STEP_LABELS: Record<WizardStepId, string> = {
  goal: "Hedef",
  campaign_budget: "Bütçe",
  audience: "Kitle",
  meta_assets: "Varlıklar",
  ad_content: "İçerik",
  review_create: "Özet",
};

const CTA_LABELS: Partial<Record<WizardCtaChoice, string>> = {
  SHOP_NOW: "Shop Now",
  LEARN_MORE: "Learn More",
  SIGN_UP: "Sign Up",
  GET_OFFER: "Get Offer",
  CALL_NOW: "Call Now",
  APPLY_NOW: "Apply Now",
  GET_QUOTE: "Get Quote",
  WHATSAPP_MESSAGE: "WhatsApp",
  SEND_MESSAGE: "Send Message",
  MESSAGE_PAGE: "Message Page",
  WATCH_MORE: "Watch More",
  NO_BUTTON: "No Button",
  INSTALL_MOBILE_APP: "Install App",
  USE_APP: "Use App",
};

function defaultDraft(): CampaignDraft {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return {
    recipeId: null,
    campaignName: "",
    dailyBudget: 250,
    startDate: iso,
    endDate: "",
    country: null,
    city: null,
    metaCountryCode: null,
    metaCity: null,
    metaRegion: null,
    selectedAssets: {},
    ageMin: 18,
    ageMax: 65,
    gender: "ALL",
    websiteUrl: "",
    pageId: "",
    instagramActorId: "",
    pixelId: "",
    imageFile: null,
    primaryText: "",
    headline: "",
    description: "",
    cta: "LEARN_MORE",
    specialAdCategory: "NONE",
    specialAdCategoryAsked: false,
  };
}

export function SmartCampaignWizard() {
  const router = useRouter();
  const {
    isReady,
    status,
    loading: accountLoading,
    activeConnectionId,
    activeConnection,
    selectedAdAccountId,
  } = useMetaAccount();

  const [draft, setDraft] = useState<CampaignDraft>(defaultDraft());
  const [metaLocation, setMetaLocation] = useState<MetaLocationOption | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [goalAnswerId, setGoalAnswerId] = useState<string>("");
  const [clarificationId, setClarificationId] = useState<string>("");
  const [pendingClarify, setPendingClarify] = useState<GoalOption | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [showTechnical, setShowTechnical] = useState(false);
  const [specialCategoryYes, setSpecialCategoryYes] = useState<boolean | null>(null);

  const plan = useMemo(
    () => (draft.recipeId ? buildWizardPlan(draft.recipeId) : null),
    [draft.recipeId],
  );
  const steps = plan?.steps ?? (["goal"] as WizardStepId[]);
  const currentStep = steps[stepIndex] ?? "goal";

  const selectedPageId = draft.selectedAssets.page?.id ?? draft.pageId;

  const accountSnapshot = useAccountSnapshot({
    connectionId: activeConnectionId ?? undefined,
    businessId: activeConnection?.metaBusinessId ?? undefined,
    adAccountId: selectedAdAccountId ?? undefined,
    recipeId: draft.recipeId,
    pageId: selectedPageId || undefined,
  });

  const {
    snapshot,
    loading: snapshotLoading,
    error: snapshotError,
    selectedAssets,
    setSelectedAssets,
    reload: reloadSnapshot,
    reloadPageBound,
  } = accountSnapshot;

  const pages = snapshot?.pages ?? [];
  const pixels = snapshot?.pixels ?? [];
  const instagramAccounts = snapshot?.instagramAccounts ?? [];
  const instantForms = snapshot?.instantForms ?? [];
  const whatsappAccounts = snapshot?.whatsappAccounts ?? [];
  const catalogs = snapshot?.catalogs ?? [];
  const productSets = snapshot?.productSets ?? [];
  const apps = snapshot?.apps ?? [];
  const availablePixels = useMemo(() => pixels.filter((p) => p.available), [pixels]);

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeCreateStep, setActiveCreateStep] = useState<WizardCreateStep | null>(null);

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      selectedAssets,
      pageId: selectedAssets.page?.id ?? "",
      pixelId: selectedAssets.pixel?.id ?? "",
      instagramActorId: selectedAssets.instagram?.id ?? "",
      instantFormId: selectedAssets.instantForm?.id ?? "",
      whatsappId: selectedAssets.whatsapp?.id ?? "",
      catalogId: selectedAssets.catalog?.id ?? "",
      productSetId: selectedAssets.productSet?.id ?? "",
      appId: selectedAssets.app?.id ?? "",
      metaCountryCode: selectedAssets.location?.countryCode ?? current.metaCountryCode,
    }));
  }, [selectedAssets]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    if (draft.recipeId && !draft.campaignName.trim()) {
      setDraft((current) => ({
        ...applyRecipeDefaults(current, draft.recipeId as CampaignRecipeId),
      }));
    }
  }, [draft.recipeId, draft.campaignName]);

  const recipe = draft.recipeId ? CAMPAIGN_RECIPES[draft.recipeId] : null;
  const technical = draft.recipeId ? getTechnicalSummary(draft.recipeId) : null;

  function setField<K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function selectGoal(option: GoalOption) {
    setGoalAnswerId(option.id);
    setClarificationId("");
    const resolution = resolveGoalSelection(option.id);
    if (resolution.status === "clarify") {
      setPendingClarify(option);
      return;
    }
    if (resolution.status === "resolved") {
      setPendingClarify(null);
      setDraft((current) =>
        applyRecipeDefaults(
          { ...current, recipeId: resolution.recipeId, goalAnswerId: resolution.goalAnswerId },
          resolution.recipeId,
        ),
      );
      setStepIndex(1);
    }
  }

  function selectClarification(optionId: string) {
    if (!pendingClarify) return;
    setClarificationId(optionId);
    const resolution = resolveGoalSelection(pendingClarify.id, optionId);
    if (resolution.status === "resolved") {
      setPendingClarify(null);
      setDraft((current) =>
        applyRecipeDefaults(
          { ...current, recipeId: resolution.recipeId, goalAnswerId: resolution.goalAnswerId },
          resolution.recipeId,
        ),
      );
      setStepIndex(1);
    }
  }

  function selectMetaLocation(location: MetaLocationOption | null) {
    setMetaLocation(location);
    setSelectedAssets((current) => {
      const next = { ...current };
      if (!location) {
        delete next.location;
        return next;
      }
      next.location = {
        key: location.key,
        type: location.type,
        displayName: location.displayName,
        countryCode: location.countryCode,
      };
      return next;
    });
    setDraft((current) => ({
      ...current,
      metaCountryCode: location?.countryCode ?? null,
    }));
  }

  async function selectPage(pageId: string) {
    const page = pages.find((item) => item.id === pageId);
    setSelectedAssets((current) => ({
      ...current,
      page: page ? { id: page.id, name: formatPageOptionLabel(page) } : undefined,
      instagram: undefined,
      instantForm: undefined,
      whatsapp: undefined,
    }));
    setField("pageId", pageId);
    if (page && draft.recipeId) {
      await reloadPageBound(pageId, formatPageOptionLabel(page));
    }
  }

  async function handleImageSelected(file: File | null) {
    setErrors((e) => ({ ...e, imageFile: "" }));
    setImageHash("");
    if (!file) {
      setField("imageFile", null);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setErrors((e) => ({ ...e, imageFile: "Yalnızca JPG/PNG/WEBP yükleyin" }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((e) => ({ ...e, imageFile: "Dosya boyutu çok büyük (max 8MB)" }));
      return;
    }
    setField("imageFile", file);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(URL.createObjectURL(file));
    setImageUploading(true);
    try {
      const res = await uploadAdImage(file);
      setImageHash(res.imageHash);
      toast.success("Görsel yüklendi.");
    } catch (e) {
      setErrors((err) => ({ ...err, imageFile: "Görsel yüklenemedi" }));
      toast.error(e instanceof Error ? e.message : "Görsel yüklenemedi");
    } finally {
      setImageUploading(false);
    }
  }

  async function handleCreate() {
    const next = validateCampaignDraft(draft);
    setErrors(next as Record<string, string>);
    if (hasErrors(next)) return;
    if (!imageHash || !draft.recipeId) return;

    const payload: CampaignSubmit = {
      recipeId: draft.recipeId,
      campaignName: draft.campaignName || generateCampaignName(draft.recipeId),
      dailyBudget: draft.dailyBudget,
      startDate: draft.startDate,
      endDate: draft.endDate?.trim() ? draft.endDate : undefined,
      country: draft.country,
      city: draft.city,
      metaCountryCode: draft.metaCountryCode,
      metaCity: draft.metaCity,
      metaRegion: draft.metaRegion,
      selectedAssets: draft.selectedAssets,
      ageMin: draft.ageMin,
      ageMax: draft.ageMax,
      gender: draft.gender,
      websiteUrl: draft.websiteUrl,
      pageId: draft.selectedAssets.page?.id ?? draft.pageId,
      instagramActorId: draft.selectedAssets.instagram?.id ?? draft.instagramActorId,
      pixelId: draft.selectedAssets.pixel?.id ?? draft.pixelId,
      instantFormId: draft.selectedAssets.instantForm?.id ?? draft.instantFormId,
      whatsappId: draft.selectedAssets.whatsapp?.id ?? draft.whatsappId,
      catalogId: draft.selectedAssets.catalog?.id ?? draft.catalogId,
      productSetId: draft.selectedAssets.productSet?.id ?? draft.productSetId,
      appId: draft.selectedAssets.app?.id ?? draft.appId,
      primaryText: draft.primaryText,
      headline: draft.headline,
      description: draft.description?.trim() ? draft.description : undefined,
      cta: draft.cta,
      specialAdCategory: draft.specialAdCategory,
      imageHash,
    };

    setSubmitting(true);
    setActiveCreateStep("create_campaign");
    try {
      const result = await runRecipeWizard(payload);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (result.campaignId) {
        router.push(`/campaigns/${result.campaignId}`);
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Oluşturma başarısız");
    } finally {
      setSubmitting(false);
      setActiveCreateStep(null);
    }
  }

  if (!accountLoading && status && !status.connected) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Reklam oluşturmak için önce Meta hesabını bağlayın.{" "}
        <a href="/settings" className="text-primary hover:underline">Ayarlar</a>
      </div>
    );
  }

  if (!accountLoading && status?.connected && !isReady) {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200">
        Reklam oluşturmak için Ayarlar sayfasından reklam hesabı ekleyin ve üst bardan seçin.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Akıllı Reklam Sihirbazı</CardTitle>
          <CardDescription>
            {recipe
              ? `Hedef: ${recipe.outcomeLabel}`
              : "Bu reklamdan nasıl bir sonuç almak istiyorsunuz?"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {steps.map((stepId, index) => (
              <Button
                key={stepId}
                type="button"
                size="sm"
                variant={stepIndex === index ? "default" : "outline"}
                disabled={!draft.recipeId && stepId !== "goal"}
                onClick={() => setStepIndex(index)}
              >
                {STEP_LABELS[stepId]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {currentStep === "goal" && (
        <Card>
          <CardHeader>
            <CardTitle>Bu reklamdan nasıl bir sonuç almak istiyorsunuz?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {PRIMARY_GOAL_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant={goalAnswerId === option.id ? "default" : "outline"}
                className="h-auto justify-start whitespace-normal py-3 text-left"
                onClick={() => selectGoal(option)}
              >
                {option.label}
              </Button>
            ))}
            {pendingClarify?.clarificationQuestion && (
              <div className="mt-4 space-y-2 rounded-lg border p-4">
                <p className="text-sm font-medium">{pendingClarify.clarificationQuestion}</p>
                {pendingClarify.clarificationOptions?.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant={clarificationId === option.id ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => selectClarification(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}
            {errors.recipeId && <p className="text-xs text-destructive">{errors.recipeId}</p>}
          </CardContent>
        </Card>
      )}

      {currentStep === "campaign_budget" && (
        <Card>
          <CardHeader><CardTitle>Bütçe ve tarihler</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Günlük bütçe (TL)</Label>
              <Input type="number" value={String(draft.dailyBudget)} onChange={(e) => setField("dailyBudget", Number(e.target.value))} />
              {errors.dailyBudget && <p className="text-xs text-destructive">{errors.dailyBudget}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Başlangıç</Label>
              <Input type="date" value={draft.startDate} onChange={(e) => setField("startDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bitiş (opsiyonel)</Label>
              <Input type="date" value={draft.endDate ?? ""} onChange={(e) => setField("endDate", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Bu reklam kredi, istihdam, konut, sosyal konular, seçimler veya siyaset ile ilgili mi?</Label>
              <div className="flex gap-2">
                <Button type="button" variant={specialCategoryYes === false ? "default" : "outline"} onClick={() => {
                  setSpecialCategoryYes(false);
                  setField("specialAdCategory", "NONE");
                  setField("specialAdCategoryAsked", true);
                }}>Hayır</Button>
                <Button type="button" variant={specialCategoryYes === true ? "default" : "outline"} onClick={() => {
                  setSpecialCategoryYes(true);
                  setField("specialAdCategoryAsked", true);
                }}>Evet</Button>
              </div>
              {specialCategoryYes && (
                <Select value={draft.specialAdCategory} onValueChange={(v) => setField("specialAdCategory", v as WizardSpecialAdCategory)}>
                  <SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYMENT">İstihdam</SelectItem>
                    <SelectItem value="HOUSING">Konut</SelectItem>
                    <SelectItem value="CREDIT">Kredi</SelectItem>
                    <SelectItem value="FINANCIAL_PRODUCTS_SERVICES">Finansal Ürün ve Hizmetler</SelectItem>
                    <SelectItem value="ISSUES_ELECTIONS_POLITICS">Sosyal Konular / Seçim / Politika</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === "audience" && (
        <Card>
          <CardHeader><CardTitle>Hedef kitle</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetaLocationAutocomplete
              label="Konum"
              placeholder="Konum ara (örn: İstanbul)"
              value={metaLocation}
              onSelect={selectMetaLocation}
              connectionId={activeConnectionId ?? undefined}
              disabled={!isReady || submitting}
              minChars={2}
              error={errors.city}
            />
            <div className="space-y-1.5">
              <Label>Min yaş</Label>
              <Input type="number" value={String(draft.ageMin)} onChange={(e) => setField("ageMin", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Max yaş</Label>
              <Input type="number" value={String(draft.ageMax)} onChange={(e) => setField("ageMax", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cinsiyet</Label>
              <Select value={draft.gender} onValueChange={(v) => setField("gender", v as WizardGender)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tümü</SelectItem>
                  <SelectItem value="MALE">Erkek</SelectItem>
                  <SelectItem value="FEMALE">Kadın</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === "meta_assets" && plan && (
        <Card>
          <CardHeader>
            <CardTitle>Gerekli Meta varlıkları</CardTitle>
            <CardDescription>Yalnızca bu kampanya türü için gerekli veriler yüklendi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshotLoading && <p className="text-sm text-muted-foreground">Varlıklar yükleniyor...</p>}
            {snapshotError && <p className="text-sm text-destructive">{snapshotError}</p>}
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => void reloadSnapshot()}>Yenile</Button>
            </div>

            {plan.requiredAssets.includes("page") && (
              <AssetPicker
                label="Facebook Page"
                loading={snapshotLoading}
                emptyMessage="Hiç Facebook Page bulunamadı."
                options={pages.map((p) => ({ id: p.id, label: formatPageOptionLabel(p) }))}
                value={selectedPageId}
                onChange={(id) => void selectPage(id)}
                error={errors.pageId}
              />
            )}

            {plan.needsPixel && (
              <AssetPicker
                label="Pixel"
                loading={snapshotLoading}
                emptyMessage="Pixel bulunamadı."
                options={availablePixels.map((p) => ({ id: p.id, label: p.name }))}
                value={draft.selectedAssets.pixel?.id ?? draft.pixelId}
                onChange={(id) => {
                  const pixel = availablePixels.find((p) => p.id === id);
                  setSelectedAssets((c) => ({ ...c, pixel: pixel ? { id: pixel.id, name: pixel.name } : undefined }));
                  setField("pixelId", id);
                }}
                error={errors.pixelId}
              />
            )}

            {plan.requiredAssets.includes("instagram") && (
              <AssetPicker
                label="Instagram"
                loading={snapshotLoading}
                emptyMessage="Instagram hesabı bulunamadı."
                options={instagramAccounts.map((a) => ({ id: a.id, label: a.username ?? a.name ?? a.id }))}
                value={draft.selectedAssets.instagram?.id ?? ""}
                onChange={(id) => {
                  const account = instagramAccounts.find((a) => a.id === id);
                  setSelectedAssets((c) => ({ ...c, instagram: account ? { id: account.id, username: account.username, name: account.name } : undefined }));
                }}
                error={errors.instagramActorId}
              />
            )}

            {plan.needsInstantForm && (
              <AssetPicker
                label="Meta Form"
                loading={snapshotLoading}
                emptyMessage="Anlık form bulunamadı."
                options={instantForms.map((f) => ({ id: f.id, label: f.name }))}
                value={draft.selectedAssets.instantForm?.id ?? ""}
                onChange={(id) => {
                  const form = instantForms.find((f) => f.id === id);
                  setSelectedAssets((c) => ({ ...c, instantForm: form ? { id: form.id, name: form.name } : undefined }));
                }}
                error={errors.instantFormId}
              />
            )}

            {plan.needsWhatsApp && (
              <AssetPicker
                label="WhatsApp"
                loading={snapshotLoading}
                emptyMessage="WhatsApp numarası bulunamadı."
                options={whatsappAccounts.map((w) => ({ id: w.id, label: w.name }))}
                value={draft.selectedAssets.whatsapp?.id ?? ""}
                onChange={(id) => {
                  const wa = whatsappAccounts.find((w) => w.id === id);
                  setSelectedAssets((c) => ({ ...c, whatsapp: wa ? { id: wa.id, name: wa.name } : undefined }));
                }}
                error={errors.whatsappId}
              />
            )}

            {plan.needsCatalog && (
              <>
                <AssetPicker
                  label="Katalog"
                  loading={snapshotLoading}
                  emptyMessage="Katalog bulunamadı."
                  options={catalogs.map((c) => ({ id: c.id, label: c.name }))}
                  value={draft.selectedAssets.catalog?.id ?? ""}
                  onChange={(id) => {
                    const catalog = catalogs.find((c) => c.id === id);
                    setSelectedAssets((c) => ({ ...c, catalog: catalog ? { id: catalog.id, name: catalog.name } : undefined }));
                  }}
                  error={errors.catalogId}
                />
                {productSets.length > 0 && (
                  <AssetPicker
                    label="Ürün Seti"
                    loading={snapshotLoading}
                    emptyMessage="Ürün seti bulunamadı."
                    options={productSets.map((s) => ({ id: s.id, label: s.name }))}
                    value={draft.selectedAssets.productSet?.id ?? ""}
                    onChange={(id) => {
                      const set = productSets.find((s) => s.id === id);
                      setSelectedAssets((c) => ({ ...c, productSet: set ? { id: set.id, name: set.name } : undefined }));
                    }}
                  />
                )}
              </>
            )}

            {plan.needsApp && (
              <AssetPicker
                label="Uygulama"
                loading={snapshotLoading}
                emptyMessage="Uygulama bulunamadı."
                options={apps.map((a) => ({ id: a.id, label: a.name }))}
                value={draft.selectedAssets.app?.id ?? ""}
                onChange={(id) => {
                  const app = apps.find((a) => a.id === id);
                  setSelectedAssets((c) => ({ ...c, app: app ? { id: app.id, name: app.name } : undefined }));
                }}
                error={errors.appId}
              />
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === "ad_content" && recipe && (
        <Card>
          <CardHeader><CardTitle>Reklam içeriği</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {plan?.needsWebsiteUrl && (
              <div className="space-y-1.5">
                <Label>Website URL</Label>
                <Input value={draft.websiteUrl} onChange={(e) => setField("websiteUrl", e.target.value)} placeholder="https://..." />
                {errors.websiteUrl && <p className="text-xs text-destructive">{errors.websiteUrl}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Görsel veya video karesi</Label>
              <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void handleImageSelected(e.target.files?.[0] ?? null)} disabled={imageUploading} />
              {errors.imageFile && <p className="text-xs text-destructive">{errors.imageFile}</p>}
              {imagePreviewUrl && (
                <div className="relative mt-2 h-20 w-20 overflow-hidden rounded-md border">
                  <Image src={imagePreviewUrl} alt="" fill className="object-cover" />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Reklam metni</Label>
              <Input value={draft.primaryText} onChange={(e) => setField("primaryText", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Başlık</Label>
              <Input value={draft.headline} onChange={(e) => setField("headline", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CTA</Label>
              <Select value={draft.cta} onValueChange={(v) => setField("cta", v as WizardCtaChoice)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {recipe.supportedCtas.map((cta) => (
                    <SelectItem key={cta} value={cta}>{CTA_LABELS[cta] ?? cta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === "review_create" && recipe && (
        <Card>
          <CardHeader>
            <CardTitle>Özet ve oluşturma</CardTitle>
            <CardDescription>Onay vermeden Meta hesabinda hicbir varlik olusturulmaz.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div><b>Sonuç:</b> {recipe.outcomeLabel}</div>
                <div><b>Dönüşüm yeri:</b> {recipe.conversionLocation}</div>
                <div><b>Günlük bütçe:</b> {draft.dailyBudget} TL</div>
                <div><b>Tarih:</b> {draft.startDate}{draft.endDate ? ` → ${draft.endDate}` : ""}</div>
                <div><b>Konum:</b> {draft.selectedAssets.location?.displayName ?? "—"}</div>
                <div><b>Yaş:</b> {draft.ageMin}–{draft.ageMax}</div>
                <div><b>Page:</b> {draft.selectedAssets.page?.name ?? "—"}</div>
                {draft.selectedAssets.pixel && <div><b>Pixel:</b> {draft.selectedAssets.pixel.name}</div>}
                {draft.selectedAssets.instantForm && <div><b>Form:</b> {draft.selectedAssets.instantForm.name}</div>}
                {draft.selectedAssets.whatsapp && <div><b>WhatsApp:</b> {draft.selectedAssets.whatsapp.name}</div>}
                <div><b>CTA:</b> {CTA_LABELS[draft.cta] ?? draft.cta}</div>
                <div><b>Durum:</b> Paused</div>
              </div>
            </div>

            <Button type="button" variant="ghost" size="sm" onClick={() => setShowTechnical((v) => !v)}>
              {showTechnical ? "Teknik ayarları gizle" : "Teknik ayarları gör"}
            </Button>
            {showTechnical && technical && (
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                <div>Objective: {technical.objective}</div>
                <div>Conversion location: {technical.conversionLocation}</div>
                <div>Optimization: {technical.optimizationGoal}</div>
                <div>Billing: {technical.billingEvent}</div>
                <div>Bid strategy: {technical.bidStrategy}</div>
                <div>Promoted object: {technical.promotedObjectKeys}</div>
                <div>Placements: {technical.placements}</div>
              </div>
            )}

            {activeCreateStep && <p className="text-sm text-muted-foreground">{CREATE_STEP_LABELS[activeCreateStep]}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>Geri</Button>
              {stepIndex < steps.length - 1 ? (
                <Button type="button" className="flex-1" onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}>İleri</Button>
              ) : (
                <Button className="flex-1" disabled={submitting || imageUploading} onClick={() => void handleCreate()}>
                  {submitting ? "Oluşturuluyor..." : "Reklamı Oluştur"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AssetPicker({
  label,
  loading,
  emptyMessage,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  loading: boolean;
  emptyMessage: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">{label} yükleniyor...</p>;
  if (options.length === 0) return <p className="text-sm text-destructive">{emptyMessage}</p>;
  if (options.length === 1) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          {options[0].label}
          <span className="ml-2 text-muted-foreground">(otomatik seçildi)</span>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={`${label} seçin`} /></SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
