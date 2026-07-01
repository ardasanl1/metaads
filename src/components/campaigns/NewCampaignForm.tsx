"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { useMetaAccount } from "@/hooks/use-meta-account";
import { createCampaign } from "@/services/meta/client";
import {
  BUYING_TYPES,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STATUSES,
  NO_SPECIAL_CATEGORY,
  SPECIAL_AD_CATEGORIES,
  type BuyingType,
  type CampaignObjective,
  type CampaignStatus,
  type SpecialAdCategoryApi,
  type SpecialAdCategoryForm,
} from "@/utils/campaign-constants";
import { cn } from "@/utils/cn";

type FormErrors = {
  name?: string;
  objective?: string;
  buyingType?: string;
  specialAdCategories?: string;
};

function FieldHint({ children }: { children: string }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function NewCampaignForm() {
  const router = useRouter();
  const { isReady, status, loading: accountLoading } = useMetaAccount();

  const [name, setName] = useState("");
  const [objective, setObjective] = useState<CampaignObjective | "">("");
  const [buyingType, setBuyingType] = useState<BuyingType>("AUCTION");
  const [noSpecialCategory, setNoSpecialCategory] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<SpecialAdCategoryApi[]>([]);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>("PAUSED");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = isReady && !submitting;

  const selectedObjective = CAMPAIGN_OBJECTIVES.find((item) => item.value === objective);
  const selectedBuyingType = BUYING_TYPES.find((item) => item.value === buyingType);
  const selectedStatus = CAMPAIGN_STATUSES.find((item) => item.value === campaignStatus);

  function toggleCategory(value: SpecialAdCategoryApi) {
    setNoSpecialCategory(false);
    setSelectedCategories((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function selectNoSpecialCategory() {
    setNoSpecialCategory(true);
    setSelectedCategories([]);
  }

  function buildSpecialCategoriesPayload(): SpecialAdCategoryForm[] {
    if (noSpecialCategory || selectedCategories.length === 0) {
      return [NO_SPECIAL_CATEGORY];
    }
    return selectedCategories;
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!name.trim()) next.name = "Kampanya adı gerekli";
    if (!objective) next.objective = "Kampanya hedefi seçin";
    if (!buyingType) next.buyingType = "Satın alma türü seçin";
    if (!noSpecialCategory && selectedCategories.length === 0) {
      next.specialAdCategories = "En az bir özel kategori seçin veya standart reklamı işaretleyin";
    }
    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isReady) {
      toast.error("Kampanya oluşturmak için firma ve reklam hesabı seçin.");
      return;
    }

    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      const result = await createCampaign({
        name: name.trim(),
        objective: objective as CampaignObjective,
        buyingType,
        specialAdCategories: buildSpecialCategoriesPayload(),
        status: campaignStatus,
      });
      toast.success("Kampanya başarıyla oluşturuldu.");
      router.push(`/campaigns/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kampanya oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {!accountLoading && status && !status.connected && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Kampanya oluşturmak için önce Meta hesabını bağlayın.{" "}
          <Link href="/settings/integrations" className="text-primary hover:underline">
            Entegrasyonlara git
          </Link>
        </div>
      )}

      {!accountLoading && status?.connected && !isReady && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200">
          Kampanya oluşturmak için üst bardan bir firma ve reklam hesabı seçin.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yeni Kampanya</CardTitle>
          <CardDescription>
            Kampanya oluşturulduktan sonra reklam seti ve reklam ekleyerek yayına alabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Kampanya adı</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Örn: Bahar İndirimi 2026"
                disabled={!canSubmit}
              />
              <FieldHint>Panelde ve Meta Reklam Yöneticisi&apos;nde görünecek isim.</FieldHint>
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Kampanya hedefi</Label>
              <Select
                value={objective}
                onValueChange={(value) => setObjective(value as CampaignObjective)}
                disabled={!canSubmit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Hedef seçin" />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_OBJECTIVES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedObjective && <FieldHint>{selectedObjective.description}</FieldHint>}
              {errors.objective && <p className="text-xs text-destructive">{errors.objective}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Satın alma türü</Label>
              <Select
                value={buyingType}
                onValueChange={(value) => setBuyingType(value as BuyingType)}
                disabled={!canSubmit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Satın alma türü seçin" />
                </SelectTrigger>
                <SelectContent>
                  {BUYING_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBuyingType && <FieldHint>{selectedBuyingType.description}</FieldHint>}
              {errors.buyingType && <p className="text-xs text-destructive">{errors.buyingType}</p>}
            </div>

            <div className="space-y-3">
              <div>
                <Label>Özel reklam kategorisi</Label>
                <FieldHint>
                  Meta, konut, istihdam, finans veya siyasi içerikli reklamlar için özel kategori
                  bildirimi zorunlu tutar. Standart reklamlar için aşağıdaki ilk seçeneği işaretli
                  bırakın.
                </FieldHint>
              </div>

              <button
                type="button"
                disabled={!canSubmit}
                onClick={selectNoSpecialCategory}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  noSpecialCategory
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40",
                )}
              >
                <p className="text-sm font-medium">Standart reklam (özel kategori yok)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ürün, marka veya genel tanıtım reklamları için uygun seçenek.
                </p>
              </button>

              <div className="space-y-2">
                {SPECIAL_AD_CATEGORIES.map((item) => {
                  const checked = !noSpecialCategory && selectedCategories.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      disabled={!canSubmit}
                      onClick={() => toggleCategory(item.value)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40",
                      )}
                    >
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    </button>
                  );
                })}
              </div>
              {errors.specialAdCategories && (
                <p className="text-xs text-destructive">{errors.specialAdCategories}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Başlangıç durumu</Label>
              <Select
                value={campaignStatus}
                onValueChange={(value) => setCampaignStatus(value as CampaignStatus)}
                disabled={!canSubmit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_STATUSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStatus && <FieldHint>{selectedStatus.description}</FieldHint>}
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" asChild>
                <Link href="/campaigns">İptal</Link>
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? "Oluşturuluyor..." : "Kampanya Oluştur"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
