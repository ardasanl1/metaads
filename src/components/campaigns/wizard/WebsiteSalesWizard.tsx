"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { WEBSITE_SALES_RECIPE } from "@/config/campaign-recipes";
import type {
  WebsiteSalesDraft,
  WebsiteSalesSubmit,
  WizardCreateStep,
  WizardCtaChoice,
  WizardGender,
  WizardSpecialAdCategory,
} from "@/types/campaign-wizard";
import { hasErrors, validateWebsiteSalesDraft } from "@/utils/campaign-wizard-validation";
import { useMetaAccount } from "@/hooks/use-meta-account";
import {
  fetchInstagramAccounts,
  fetchPages,
  fetchPixels,
  fetchGoogleLocationDetails,
  fetchMetaTargetingLocations,
  runWebsiteSalesWizard,
  uploadAdImage,
} from "@/services/meta/client";
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
import { LocationAutocomplete } from "@/components/locations/LocationAutocomplete";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const CREATE_STEP_LABELS: Record<WizardCreateStep, string> = {
  upload_image: "Görsel yükleniyor",
  create_campaign: "Kampanya oluşturuluyor",
  create_adset: "Reklam seti oluşturuluyor",
  create_creative: "Creative oluşturuluyor",
  create_ad: "Reklam oluşturuluyor",
};

function defaultDraft(): WebsiteSalesDraft {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const iso = `${yyyy}-${mm}-${dd}`;

  return {
    campaignName: "",
    dailyBudget: 250,
    startDate: iso,
    endDate: "",
    country: null,
    city: null,
    metaCountryCode: null,
    metaCity: null,
    metaRegion: null,
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
    cta: "SHOP_NOW",
    specialAdCategory: "NONE",
  };
}

export function WebsiteSalesWizard() {
  const router = useRouter();
  const { isReady, status, loading: accountLoading } = useMetaAccount();

  const [draft, setDraft] = useState<WebsiteSalesDraft>(defaultDraft());
  const [locationSessionToken] = useState(() => crypto.randomUUID());
  const [countrySuggestion, setCountrySuggestion] = useState<{ placeId: string; displayName: string } | null>(null);
  const [citySuggestion, setCitySuggestion] = useState<{ placeId: string; displayName: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [pagesLoading, setPagesLoading] = useState(false);
  const [pages, setPages] = useState<Array<{ id: string; name: string }>>([]);

  const [igLoading, setIgLoading] = useState(false);
  const [igAccounts, setIgAccounts] = useState<Array<{ id: string; username?: string; name?: string }>>([]);

  const [pixelsLoading, setPixelsLoading] = useState(false);
  const [pixels, setPixels] = useState<Array<{ id: string; name?: string }>>([]);

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState<string>("");
  const [imageUploading, setImageUploading] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submitting, setSubmitting] = useState(false);
  const [activeCreateStep, setActiveCreateStep] = useState<WizardCreateStep | null>(null);

  const canSubmit = isReady && !submitting && !imageUploading;

  useEffect(() => {
    if (accountLoading) return;
    if (!status?.connected) return;
    if (!isReady) return;

    setPagesLoading(true);
    fetchPages()
      .then(setPages)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Page listesi alınamadı"))
      .finally(() => setPagesLoading(false));

    setPixelsLoading(true);
    fetchPixels()
      .then((items) => {
        setPixels(items);
        if (items.length === 0) {
          toast.error(
            "Website satış reklamı oluşturmak için kullanılabilir bir Pixel bulunamadı.",
          );
        }
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Pixel listesi alınamadı"))
      .finally(() => setPixelsLoading(false));
  }, [accountLoading, status?.connected, isReady]);

  useEffect(() => {
    if (!draft.pageId) {
      setIgAccounts([]);
      setDraft((d) => ({ ...d, instagramActorId: "" }));
      return;
    }

    setIgLoading(true);
    fetchInstagramAccounts(draft.pageId)
      .then((items) => {
        setIgAccounts(items);
        if (items.length === 1) {
          setDraft((d) => ({ ...d, instagramActorId: items[0].id }));
        }
      })
      .catch(() => setIgAccounts([]))
      .finally(() => setIgLoading(false));
  }, [draft.pageId]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const review = useMemo(() => {
    const pageName = pages.find((p) => p.id === draft.pageId)?.name ?? "—";
    const pixelName = pixels.find((p) => p.id === draft.pixelId)?.name ?? draft.pixelId ?? "—";
    const igLabel =
      igAccounts.find((a) => a.id === draft.instagramActorId)?.username ??
      igAccounts.find((a) => a.id === draft.instagramActorId)?.name ??
      (draft.instagramActorId ? draft.instagramActorId : "Seçilmedi");

    return {
      pageName,
      pixelName,
      igLabel,
    };
  }, [draft.pageId, draft.pixelId, draft.instagramActorId, pages, pixels, igAccounts]);

  function setField<K extends keyof WebsiteSalesDraft>(key: K, value: WebsiteSalesDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function selectCountrySuggestion(s: { placeId: string; displayName: string } | null) {
    setCountrySuggestion(s);
    setCitySuggestion(null);
    setLocationError("");
    setField("city", null);
    setField("metaCity", null);
    setField("metaRegion", null);
    setField("country", null);
    setField("metaCountryCode", null);
    if (!s) return;

    setLocationLoading(true);
    try {
      const sel = await fetchGoogleLocationDetails({ placeId: s.placeId, sessionToken: locationSessionToken });
      setField("country", sel);
      setField("metaCountryCode", sel.countryCode.toUpperCase());
    } catch (e) {
      setLocationError(e instanceof Error ? e.message : "Ülke seçilemedi");
    } finally {
      setLocationLoading(false);
    }
  }

  async function selectCitySuggestion(s: { placeId: string; displayName: string } | null) {
    setCitySuggestion(s);
    setLocationError("");
    setField("city", null);
    setField("metaCity", null);
    setField("metaRegion", null);
    if (!s) return;

    if (!draft.country?.countryCode) {
      setLocationError("Önce ülke seçin");
      return;
    }

    setLocationLoading(true);
    try {
      const sel = await fetchGoogleLocationDetails({ placeId: s.placeId, sessionToken: locationSessionToken });
      setField("city", sel);

      const query = sel.cityName || sel.regionName || sel.displayName;
      const candidates = await fetchMetaTargetingLocations({
        query,
        countryCode: draft.country.countryCode,
        locationType: "city",
      });
      const exact = candidates.find((c) => c.name.toLowerCase() === (sel.cityName ?? "").toLowerCase());
      const best = exact ?? candidates[0] ?? null;
      if (!best) {
        setLocationError("Şehir Meta hedefleme konumuna eşlenemedi");
      } else {
        setField("metaCity", best);
      }
    } catch (e) {
      setLocationError(e instanceof Error ? e.message : "Şehir seçilemedi");
    } finally {
      setLocationLoading(false);
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

  function validateCurrent(): boolean {
    const next = validateWebsiteSalesDraft(draft);
    setErrors(next as Record<string, string>);
    return !hasErrors(next);
  }

  async function handleCreate() {
    if (!validateCurrent()) return;
    if (!imageHash) {
      toast.error("Görsel yüklenmedi. Lütfen görseli yükleyin.");
      return;
    }
    if (pixels.length === 0) {
      toast.error("Website satış reklamı oluşturmak için kullanılabilir bir Pixel bulunamadı.");
      return;
    }
    if (!draft.pageId) {
      toast.error("Facebook Page seçin.");
      return;
    }

    const payload: WebsiteSalesSubmit = {
      campaignName: draft.campaignName,
      dailyBudget: draft.dailyBudget,
      startDate: draft.startDate,
      endDate: draft.endDate?.trim() ? draft.endDate : undefined,
      country: draft.country,
      city: draft.city,
      metaCountryCode: draft.metaCountryCode,
      metaCity: draft.metaCity,
      metaRegion: draft.metaRegion,
      ageMin: draft.ageMin,
      ageMax: draft.ageMax,
      gender: draft.gender,
      websiteUrl: draft.websiteUrl,
      pageId: draft.pageId,
      instagramActorId: draft.instagramActorId?.trim() ? draft.instagramActorId : undefined,
      pixelId: draft.pixelId,
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
      const result = await runWebsiteSalesWizard(payload);
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
        <a href="/settings" className="text-primary hover:underline">
          Ayarlara git
        </a>
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
          <CardTitle>Otomatik Website Satış Reklamı</CardTitle>
          <CardDescription>
            Tek tıkla 1 Campaign + 1 Ad Set + 1 Creative + 1 Ad oluşturur. Tümü <b>PAUSED</b>{" "}
            başlar. Yerleşimler: <b>Otomatik (Advantage+)</b>. Event: <b>Purchase</b>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3, 4, 5] as const).map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={step === s ? "default" : "outline"}
                onClick={() => setStep(s)}
              >
                {s}. Adım
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>1) Kampanya ve bütçe</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Kampanya adı</Label>
              <Input value={draft.campaignName} onChange={(e) => setField("campaignName", e.target.value)} />
              {errors.campaignName && <p className="text-xs text-destructive">{errors.campaignName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Günlük bütçe (TL)</Label>
              <Input
                type="number"
                value={String(draft.dailyBudget)}
                onChange={(e) => setField("dailyBudget", Number(e.target.value))}
              />
              {errors.dailyBudget && <p className="text-xs text-destructive">{errors.dailyBudget}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Başlangıç</Label>
              <Input type="date" value={draft.startDate} onChange={(e) => setField("startDate", e.target.value)} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Bitiş (opsiyonel)</Label>
              <Input type="date" value={draft.endDate ?? ""} onChange={(e) => setField("endDate", e.target.value)} />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Special Ad Category</Label>
              <Select
                value={draft.specialAdCategory}
                onValueChange={(v) => setField("specialAdCategory", v as WizardSpecialAdCategory)}
              >
                <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Yok</SelectItem>
                  <SelectItem value="EMPLOYMENT">İstihdam</SelectItem>
                  <SelectItem value="HOUSING">Konut</SelectItem>
                  <SelectItem value="CREDIT">Kredi</SelectItem>
                  <SelectItem value="FINANCIAL_PRODUCTS_SERVICES">Finansal Ürün ve Hizmetler</SelectItem>
                  <SelectItem value="ISSUES_ELECTIONS_POLITICS">Sosyal Konular / Seçim / Politika</SelectItem>
                </SelectContent>
              </Select>
              {errors.specialAdCategory && <p className="text-xs text-destructive">{errors.specialAdCategory}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>2) Hedef kitle</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <LocationAutocomplete
              label="Ülke"
              placeholder="Ülke ara (örn: Türkiye)"
              value={countrySuggestion}
              onSelect={(v) => void selectCountrySuggestion(v)}
              sessionToken={locationSessionToken}
              error={errors.country || locationError}
              disabled={!isReady || submitting}
              minChars={2}
            />
            <LocationAutocomplete
              label="Şehir (opsiyonel)"
              placeholder={!draft.country ? "Önce ülke seçin" : "Şehir ara (örn: İstanbul)"}
              value={citySuggestion}
              onSelect={(v) => void selectCitySuggestion(v)}
              sessionToken={locationSessionToken}
              countryCode={draft.country?.countryCode}
              disabled={!draft.country || !isReady || submitting}
              minChars={2}
              error={errors.city || (locationError && !errors.country ? locationError : "")}
            />

            {(draft.city && (draft.metaCity?.key || draft.metaRegion?.key)) && (
              <div className="sm:col-span-2 text-xs text-muted-foreground">
                {draft.city.displayName} — Meta hedefleme konumu doğrulandı
              </div>
            )}
            {locationLoading && (
              <div className="sm:col-span-2 text-xs text-muted-foreground">Konum doğrulanıyor...</div>
            )}
            <div className="space-y-1.5">
              <Label>Min yaş</Label>
              <Input type="number" value={String(draft.ageMin)} onChange={(e) => setField("ageMin", Number(e.target.value))} />
              {errors.ageMin && <p className="text-xs text-destructive">{errors.ageMin}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Max yaş</Label>
              <Input type="number" value={String(draft.ageMax)} onChange={(e) => setField("ageMax", Number(e.target.value))} />
              {errors.ageMax && <p className="text-xs text-destructive">{errors.ageMax}</p>}
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

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>3) Meta varlıkları</CardTitle>
            <CardDescription>Page zorunlu. Instagram hesabı varsa seçilebilir. Pixel zorunlu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Facebook Page</Label>
              <Select value={draft.pageId} onValueChange={(v) => setField("pageId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder={pagesLoading ? "Yükleniyor..." : "Page seçin"} />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.pageId && <p className="text-xs text-destructive">{errors.pageId}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Instagram hesabı (opsiyonel)</Label>
              <Select
                value={draft.instagramActorId ?? ""}
                onValueChange={(v) => setField("instagramActorId", v)}
                disabled={!draft.pageId || igLoading || igAccounts.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!draft.pageId ? "Önce Page seçin" : igLoading ? "Yükleniyor..." : igAccounts.length === 0 ? "Bulunamadı" : "Seçin"} />
                </SelectTrigger>
                <SelectContent>
                  {igAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.username ?? a.name ?? a.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Pixel</Label>
              <Select value={draft.pixelId} onValueChange={(v) => setField("pixelId", v)} disabled={pixelsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={pixelsLoading ? "Yükleniyor..." : pixels.length === 0 ? "Pixel bulunamadı" : "Pixel seçin"} />
                </SelectTrigger>
                <SelectContent>
                  {pixels.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name ?? p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.pixelId && <p className="text-xs text-destructive">{errors.pixelId}</p>}
              {pixels.length === 0 && !pixelsLoading && (
                <p className="text-sm text-destructive">
                  Website satış reklamı oluşturmak için kullanılabilir bir Pixel bulunamadı.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>4) Reklam içeriği</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Website URL</Label>
              <Input value={draft.websiteUrl} onChange={(e) => setField("websiteUrl", e.target.value)} placeholder="https://..." />
              {errors.websiteUrl && <p className="text-xs text-destructive">{errors.websiteUrl}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Görsel</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => void handleImageSelected(e.target.files?.[0] ?? null)}
                disabled={imageUploading}
              />
              {errors.imageFile && <p className="text-xs text-destructive">{errors.imageFile}</p>}
              {imagePreviewUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-20 w-20 overflow-hidden rounded-md border">
                    <Image src={imagePreviewUrl} alt="" fill className="object-cover" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {imageUploading ? "Yükleniyor..." : imageHash ? "Yüklendi" : "Bekliyor"}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Primary Text</Label>
              <Input value={draft.primaryText} onChange={(e) => setField("primaryText", e.target.value)} />
              {errors.primaryText && <p className="text-xs text-destructive">{errors.primaryText}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Headline</Label>
              <Input value={draft.headline} onChange={(e) => setField("headline", e.target.value)} />
              {errors.headline && <p className="text-xs text-destructive">{errors.headline}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description (opsiyonel)</Label>
              <Input value={draft.description ?? ""} onChange={(e) => setField("description", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>CTA</Label>
              <Select value={draft.cta} onValueChange={(v) => setField("cta", v as WizardCtaChoice)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEBSITE_SALES_RECIPE.supportedCtas.map((cta) => (
                    <SelectItem key={cta} value={cta}>
                      {cta === "SHOP_NOW" ? "Shop Now" : cta === "LEARN_MORE" ? "Learn More" : cta === "SIGN_UP" ? "Sign Up" : "Get Offer"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.cta && <p className="text-xs text-destructive">{errors.cta}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>5) Özet ve oluşturma</CardTitle>
            <CardDescription>Onay vermeden hiçbir Meta varlığı oluşturulmaz.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div><b>Kampanya adı:</b> {draft.campaignName || "—"}</div>
                <div><b>Günlük bütçe:</b> {draft.dailyBudget} TL</div>
                <div><b>Tarih:</b> {draft.startDate} {draft.endDate ? `→ ${draft.endDate}` : ""}</div>
                <div>
                  <b>Konum:</b> {draft.country?.displayName ?? "—"}
                  {draft.city ? ` / ${draft.city.displayName}` : ""}
                </div>
                <div><b>Yaş:</b> {draft.ageMin}–{draft.ageMax}</div>
                <div><b>Cinsiyet:</b> {draft.gender === "ALL" ? "Tümü" : draft.gender === "MALE" ? "Erkek" : "Kadın"}</div>
                <div className="sm:col-span-2"><b>Website URL:</b> {draft.websiteUrl || "—"}</div>
                <div className="sm:col-span-2"><b>Facebook Page:</b> {review.pageName}</div>
                <div className="sm:col-span-2"><b>Instagram:</b> {review.igLabel}</div>
                <div className="sm:col-span-2"><b>Pixel:</b> {review.pixelName}</div>
                <div className="sm:col-span-2"><b>Conversion event:</b> Purchase</div>
                <div className="sm:col-span-2"><b>Placements:</b> Otomatik (Advantage+)</div>
                <div className="sm:col-span-2"><b>Başlangıç durumu:</b> Paused</div>
              </div>
            </div>

            {activeCreateStep && (
              <div className="text-sm text-muted-foreground">
                {CREATE_STEP_LABELS[activeCreateStep]}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!canSubmit || pixels.length === 0}
              onClick={() => void handleCreate()}
            >
              {submitting ? "Oluşturuluyor..." : "Reklamı Oluştur"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

