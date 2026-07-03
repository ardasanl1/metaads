"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PanelLayout from "@/components/PanelLayout";
import { SectionCard } from "@/components/shared/SectionCard";
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
import { useMetaAccount } from "@/hooks/use-meta-account";
import { fetchOnboardingOptions, saveOnboardingSelection } from "@/services/meta/client";
import type { OnboardingOptions } from "@/types/meta-asset-sync";

export default function MetaSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeConnectionId, activeConnection, retry } = useMetaAccount();
  const [options, setOptions] = useState<OnboardingOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [businessId, setBusinessId] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  const [instagramId, setInstagramId] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const connectionId = activeConnectionId ?? "";
  const connectedFlag = searchParams.get("connected");

  useEffect(() => {
    if (!connectionId) return;
    setLoading(true);
    void fetchOnboardingOptions(connectionId)
      .then((data) => {
        setOptions(data);
        const auto = data.autoSelections;
        setBusinessId(auto.businessId ?? data.businesses[0]?.id ?? "");
        setAdAccountId(auto.adAccountId ?? data.adAccounts[0]?.id ?? "");
        setPageId(auto.pageId ?? "");
        setInstagramId(auto.instagramId ?? "");
        setPixelId(auto.pixelId ?? "");
        setWebsiteUrl(auto.websiteUrl ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Yuklenemedi"))
      .finally(() => setLoading(false));
  }, [connectionId, connectedFlag]);

  const usablePages = useMemo(
    () => options?.pages.filter((p) => p.usability === "DISCOVERED_AND_USABLE") ?? [],
    [options],
  );

  const usablePixels = useMemo(
    () =>
      options?.pixels.filter(
        (p) => p.usability === "DISCOVERED_AND_USABLE" && (!adAccountId || p.adAccountId === adAccountId),
      ) ?? [],
    [options, adAccountId],
  );

  const selectedAdAccountName =
    options?.adAccounts.find((a) => a.id === adAccountId)?.name ?? adAccountId;

  async function handleSave() {
    if (!connectionId || !adAccountId) return;
    setSaving(true);
    setError("");
    try {
      await saveOnboardingSelection({
        connectionId,
        businessId: businessId || undefined,
        adAccountId,
        adAccountName: selectedAdAccountName,
        pageId: pageId || undefined,
        pageName: usablePages.find((p) => p.id === pageId)?.name,
        instagramId: instagramId || undefined,
        instagramUsername: options?.instagramAccounts.find((i) => i.id === instagramId)?.username,
        pixelId: pixelId || undefined,
        pixelName: usablePixels.find((p) => p.id === pixelId)?.name,
        websiteUrl: websiteUrl || undefined,
      });
      await retry();
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  if (!activeConnection) {
    return (
      <PanelLayout title="Meta Hesap Kurulumu" showAccountBar={false}>
        <SectionCard title="Meta baglantisi gerekli" description="Once Meta ile baglanin.">
          <Button asChild>
            <Link href="/settings">Ayarlara git</Link>
          </Button>
        </SectionCard>
      </PanelLayout>
    );
  }

  if (activeConnection.authMethod !== "oauth") {
    return (
      <PanelLayout title="Meta Hesap Kurulumu" showAccountBar={false}>
        <SectionCard
          title="OAuth baglantisi gerekli"
          description="Meta hesap kurulumu yalnizca Meta ile Baglan akisi sonrasinda kullanilir."
        >
          <Button asChild>
            <Link href="/settings">Ayarlara git</Link>
          </Button>
        </SectionCard>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout title="Meta Hesap Kurulumu" subtitle="Varsayilan varliklarinizi bir kez secin" showAccountBar={false}>
      <div className="mx-auto max-w-2xl space-y-6">
        {connectedFlag === "1" && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200">
            Meta baglantisi basarili. Varsayilan varliklarinizi secin.
          </div>
        )}

        <SectionCard title="Varlik Secimi" description="Teknik ID gosterilmez; yalnizca isimler listelenir.">
          {loading ? (
            <p className="text-sm text-muted-foreground">Varliklar yukleniyor...</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Isletme</Label>
                <Select value={businessId} onValueChange={setBusinessId}>
                  <SelectTrigger><SelectValue placeholder="Isletme secin" /></SelectTrigger>
                  <SelectContent>
                    {options?.businesses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Reklam Hesabi</Label>
                <Select value={adAccountId} onValueChange={setAdAccountId}>
                  <SelectTrigger><SelectValue placeholder="Reklam hesabi secin" /></SelectTrigger>
                  <SelectContent>
                    {options?.adAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Facebook Sayfasi</Label>
                <Select value={pageId} onValueChange={setPageId}>
                  <SelectTrigger><SelectValue placeholder="Sayfa secin" /></SelectTrigger>
                  <SelectContent>
                    {usablePages.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Instagram (opsiyonel)</Label>
                <Select value={instagramId || "__none"} onValueChange={(v) => setInstagramId(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Instagram secin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Secilmedi</SelectItem>
                    {options?.instagramAccounts.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.username ? `@${i.username}` : i.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Pixel / Dataset</Label>
                <Select value={pixelId} onValueChange={setPixelId}>
                  <SelectTrigger><SelectValue placeholder="Pixel secin" /></SelectTrigger>
                  <SelectContent>
                    {usablePixels.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Varsayilan Website</Label>
                <Input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://ornek.com"
                />
              </div>

              {options?.assetIssues && options.assetIssues.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                  {options.assetIssues.map((issue) => (
                    <p key={`${issue.type}-${issue.name}`} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{issue.name}:</span> {issue.message}
                    </p>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" asChild>
                  <Link href="/settings">Iptal</Link>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/api/meta/oauth/connect?reauthorize=1">Baglantiyi yeniden yetkilendir</a>
                </Button>
                <Button disabled={saving || !adAccountId} onClick={() => void handleSave()}>
                  {saving ? "Kaydediliyor..." : "Kaydet ve devam et"}
                </Button>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </PanelLayout>
  );
}
