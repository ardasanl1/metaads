"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { useMetaAccount } from "@/hooks/use-meta-account";
import { createCampaign } from "@/services/meta/client";
import {
  BUYING_TYPES,
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STATUSES,
  SPECIAL_AD_CATEGORIES,
  type BuyingType,
  type CampaignObjective,
  type CampaignStatus,
  type SpecialAdCategory,
} from "@/utils/campaign-constants";

type FormErrors = {
  name?: string;
  objective?: string;
  buyingType?: string;
  specialAdCategories?: string;
};

export function NewCampaignForm() {
  const router = useRouter();
  const { isReady, status, loading: accountLoading } = useMetaAccount();

  const [name, setName] = useState("");
  const [objective, setObjective] = useState<CampaignObjective | "">("");
  const [buyingType, setBuyingType] = useState<BuyingType | "">("AUCTION");
  const [specialAdCategory, setSpecialAdCategory] = useState<SpecialAdCategory>("NONE");
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>("PAUSED");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = isReady && !submitting;

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!name.trim()) next.name = "Kampanya adı gerekli";
    if (!objective) next.objective = "Objective seçin";
    if (!buyingType) next.buyingType = "Buying type seçin";
    if (!specialAdCategory) next.specialAdCategories = "Special ad category seçin";
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
        buyingType: buyingType as BuyingType,
        specialAdCategories: [specialAdCategory],
        status: campaignStatus,
      });
      toast.success("Kampanya oluşturuldu.");
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
          Kampanya oluşturmak için bir firma ve reklam hesabı seçin.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yeni Kampanya</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Kampanya adı</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Kampanya adını girin"
                disabled={!canSubmit}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Objective</Label>
              <Select
                value={objective}
                onValueChange={(value) => setObjective(value as CampaignObjective)}
                disabled={!canSubmit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Objective seçin" />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_OBJECTIVES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.objective && <p className="text-xs text-destructive">{errors.objective}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Buying Type</Label>
              <Select
                value={buyingType}
                onValueChange={(value) => setBuyingType(value as BuyingType)}
                disabled={!canSubmit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Buying type seçin" />
                </SelectTrigger>
                <SelectContent>
                  {BUYING_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.buyingType && <p className="text-xs text-destructive">{errors.buyingType}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Special Ad Categories</Label>
              <Select
                value={specialAdCategory}
                onValueChange={(value) => setSpecialAdCategory(value as SpecialAdCategory)}
                disabled={!canSubmit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIAL_AD_CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
