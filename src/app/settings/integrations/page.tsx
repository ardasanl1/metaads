"use client";

import { FormEvent, useState } from "react";
import PanelLayout from "@/components/PanelLayout";
import { AddAdAccountForm } from "@/components/selectors/AddAdAccountForm";
import { AdAccountSelector } from "@/components/selectors/AdAccountSelector";
import { FirmSelector } from "@/components/selectors/FirmSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { disconnectConnection } from "@/services/meta/client";
import { getFirmDisplayName } from "@/utils/ad-account";

function IntegrationsBody() {
  const {
    status,
    connections,
    activeConnectionId,
    selectFirm,
    adAccounts,
    selectedAdAccountId,
    selectAdAccountById,
    addAdAccountManually,
    loading: accountLoading,
    retry,
  } = useMetaAccount();

  const [accessToken, setAccessToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleConnect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setConnecting(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/meta/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Bağlantı kurulamadı");
        return;
      }

      setAccessToken("");
      setMessage(
        "İşletme tokenı kaydedildi. Seçili firmaya Meta reklam hesabı ID ekleyerek devam edin.",
      );
      retry();
    } catch {
      setError("Bağlantı kurulurken bir hata oluştu");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(connectionId: string, firmName: string) {
    if (!confirm(`${firmName} bağlantısını kaldırmak istediğinize emin misiniz?`)) return;

    setDisconnectingId(connectionId);
    setError("");
    setMessage("");

    try {
      await disconnectConnection(connectionId);
      setMessage(`${firmName} bağlantısı kaldırıldı.`);
      retry();
    } catch {
      setError("Bağlantı kaldırılırken bir hata oluştu");
    } finally {
      setDisconnectingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Meta İşletme Bağlantısı</CardTitle>
            <CardDescription className="mt-1">
              Her işletme için ayrı access token ekleyin. Token işletme hesabına aittir; reklam
              hesaplarını sonradan Meta ID ile manuel eklersiniz.
            </CardDescription>
          </div>
          <Badge variant={status?.connected ? "success" : "muted"}>
            {connections.length > 0 ? `${connections.length} işletme` : "Bağlı Değil"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {connections.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Bağlı işletmeler</p>
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-medium">{getFirmDisplayName(connection)}</p>
                    <p className="text-xs text-muted-foreground">
                      {connection.linkedAdAccounts.length} kayıtlı reklam hesabı
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={disconnectingId === connection.id}
                    onClick={() =>
                      void handleDisconnect(connection.id, getFirmDisplayName(connection))
                    }
                  >
                    {disconnectingId === connection.id ? "Kaldırılıyor..." : "Kaldır"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleConnect} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="accessToken" className="text-sm font-medium text-foreground">
                İşletme Access Token
              </label>
              <Input
                id="accessToken"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="EAAxxxx..."
                required
                autoComplete="off"
                className="bg-background text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Token işletme (Business) hesabına ait olmalıdır. Aynı Meta kullanıcısı için token
                güncellenir.
              </p>
            </div>

            <Button type="submit" disabled={connecting}>
              {connecting ? "Bağlanıyor..." : "İşletme Bağla"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {status?.connected && activeConnectionId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reklam Hesapları</CardTitle>
            <CardDescription>
              Önce işletmeyi seçin, ardından bu işletmeye ait reklam hesaplarını Meta ID ile ekleyin.
              Tüm hesaplar otomatik çekilmez.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <FirmSelector
              connections={connections}
              value={activeConnectionId}
              onChange={(connectionId) => void selectFirm(connectionId)}
              loading={accountLoading}
            />
            <AdAccountSelector
              adAccounts={adAccounts}
              value={selectedAdAccountId}
              onChange={(adAccountId) => void selectAdAccountById(adAccountId)}
              loading={accountLoading}
            />
            <AddAdAccountForm onAdd={addAdAccountManually} disabled={accountLoading} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <PanelLayout title="Entegrasyonlar">
      <IntegrationsBody />
    </PanelLayout>
  );
}
