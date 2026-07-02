"use client";

import { useState } from "react";
import PanelLayout from "@/components/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { fetchBusinessDiscovery } from "@/services/meta/client";
import type { BusinessDiscoveryResult } from "@/types/meta/business-discovery";

function IntegrationsBody() {
  const { activeConnectionId, selectedAdAccountId } = useMetaAccount();
  const [adAccountId, setAdAccountId] = useState(selectedAdAccountId ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BusinessDiscoveryResult | null>(null);
  const [error, setError] = useState("");

  const isDev = process.env.NODE_ENV === "development";

  async function runDiagnostics() {
    if (!activeConnectionId) {
      setError("Önce Ayarlar'dan bir işletme bağlantısı seçin.");
      return;
    }
    if (!adAccountId.trim()) {
      setError("Reklam hesabı ID girin.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await fetchBusinessDiscovery({
        connectionId: activeConnectionId,
        adAccountId: adAccountId.trim(),
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tanılama başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Meta Entegrasyonları</CardTitle>
            <CardDescription>
              Business keşfi ve reklam hesabı eşleştirmesi Ayarlar üzerinden yönetilir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Reklam hesabı eklemek ve Business eşleştirmesi için{" "}
              <a href="/settings" className="text-primary hover:underline">
                Ayarlar
              </a>{" "}
              sayfasını kullanın.
            </p>
          </CardContent>
        </Card>

        {isDev && (
          <Card>
            <CardHeader>
              <CardTitle>Business Tanılama (geliştirme)</CardTitle>
              <CardDescription>
                Seçili bağlantının tokenı ile Meta Business keşfi çalıştırır. Token gösterilmez.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">connectionId</label>
                <Input value={activeConnectionId ?? ""} readOnly className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reklam hesabı ID</label>
                <Input
                  value={adAccountId}
                  onChange={(e) => setAdAccountId(e.target.value)}
                  placeholder="act_123456789"
                />
              </div>
              <Button type="button" disabled={loading} onClick={() => void runDiagnostics()}>
                {loading ? "Çalışıyor..." : "Business Tanılama"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {result && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                  <div>
                    <b>Token kullanıcısı:</b> {result.tokenUser.name} ({result.tokenUser.id})
                  </div>
                  <div>
                    <b>Granted permissions:</b>{" "}
                    {result.permissions.granted.length > 0
                      ? result.permissions.granted.join(", ")
                      : "—"}
                  </div>
                  <div>
                    <b>Declined permissions:</b>{" "}
                    {result.permissions.declined.length > 0
                      ? result.permissions.declined.join(", ")
                      : "—"}
                  </div>
                  <div>
                    <b>Business sayısı:</b> {result.businessesFound}
                  </div>
                  <div>
                    <b>Normalize ad account:</b> {result.normalizedAdAccountId}
                  </div>
                  {result.businesses.map((business) => (
                    <div key={business.id} className="rounded border border-border p-2">
                      <div>
                        <b>{business.name}</b> ({business.id})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        owned: {business.ownedAdAccountCount}, client: {business.clientAdAccountCount}
                        {business.matched ? " — eşleşti" : ""}
                      </div>
                    </div>
                  ))}
                  <div>
                    <b>Eşleşen Business:</b>{" "}
                    {result.matchedBusinesses.length > 0
                      ? result.matchedBusinesses
                          .map((b) => `${b.name} (${b.id}, ${b.relationship})`)
                          .join("; ")
                      : "Yok"}
                  </div>
                  {result.errors.length > 0 && (
                    <div>
                      <b>Hatalar:</b>
                      <ul className="mt-1 list-disc pl-5 text-destructive">
                        {result.errors.map((item, index) => (
                          <li key={`${item.step}-${index}`}>
                            [{item.step}] {item.message}
                            {item.code ? ` (kod: ${item.code})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
  );
}

export default function IntegrationsContent() {
  return (
    <PanelLayout title="Entegrasyonlar">
      <IntegrationsBody />
    </PanelLayout>
  );
}
