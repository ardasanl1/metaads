"use client";

import { FormEvent, useState } from "react";
import PanelLayout from "@/components/PanelLayout";
import { AddAdAccountForm } from "@/components/selectors/AddAdAccountForm";
import { AdAccountSelector } from "@/components/selectors/AdAccountSelector";
import { BusinessSelector } from "@/components/selectors/BusinessSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMetaAccount } from "@/hooks/use-meta-account";

function IntegrationsBody() {
  const {
    status,
    businesses,
    selectedBusinessId,
    setSelectedBusinessId,
    adAccounts,
    selectedAdAccountId,
    selectAdAccountById,
    addAdAccountManually,
    loading: accountLoading,
    retry,
  } = useMetaAccount();

  const [accessToken, setAccessToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
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
      const data = (await res.json()) as {
        error?: string;
        metaUserId?: string | null;
        selectedAdAccountId?: string | null;
        selectedAdAccountName?: string | null;
      };

      if (!res.ok) {
        setError(data.error ?? "Bağlantı kurulamadı");
        return;
      }

      setAccessToken("");
      setMessage("Meta Access Token kaydedildi. Reklam hesabı seçerek verileri görüntüleyebilirsiniz.");
      retry();
    } catch {
      setError("Bağlantı kurulurken bir hata oluştu");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Meta bağlantısını kaldırmak istediğinize emin misiniz?")) return;

    setDisconnecting(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/meta/disconnect", { method: "POST" });
      if (!res.ok) {
        setError("Bağlantı kaldırılamadı");
        return;
      }

      setAccessToken("");
      setMessage("Meta bağlantısı kaldırıldı.");
      retry();
    } catch {
      setError("Bağlantı kaldırılırken bir hata oluştu");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Meta Ads</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Sadece Access Token ile bağlanın; reklam hesabını üst menüden seçin.
            </p>
          </div>
          <Badge variant={status?.connected ? "success" : "muted"}>
            {status?.connected ? "Bağlı" : "Bağlı Değil"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {accountLoading && !status && (
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          )}

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

          {status?.connected && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              {status.metaUserId && (
                <p>
                  <span className="font-medium">Meta kullanıcı ID:</span> {status.metaUserId}
                </p>
              )}
              {status.selectedAdAccountId ? (
                <p className={status.metaUserId ? "mt-1" : ""}>
                  <span className="font-medium">Aktif reklam hesabı:</span>{" "}
                  {status.selectedAdAccountName ?? "—"} ({status.selectedAdAccountId})
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  Henüz reklam hesabı seçilmedi. Aşağıdan veya üst menüden bir hesap seçin.
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleConnect} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="accessToken" className="text-sm font-medium text-foreground">
                Meta Access Token
              </label>
              <Input
                id="accessToken"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="EAAxxxx..."
                required={!status?.connected}
                autoComplete="off"
                className="bg-background text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Nereden:{" "}
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Graph API Explorer
                </a>
                {" · İzinler: "}
                <code className="rounded bg-muted px-1">ads_read</code>,{" "}
                <code className="rounded bg-muted px-1">ads_management</code>
              </p>
            </div>

            <Button type="submit" disabled={connecting}>
              {connecting
                ? "Bağlanıyor..."
                : status?.connected
                  ? "Token Güncelle"
                  : "Meta Hesabını Bağla"}
            </Button>
          </form>

          {status?.connected && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
            >
              {disconnecting ? "Kaldırılıyor..." : "Bağlantıyı Kaldır"}
            </Button>
          )}
        </CardContent>
      </Card>

      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reklam Hesabı Seçimi</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tüm kampanya ve istatistik verileri seçilen hesaba göre çekilir.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <BusinessSelector
              businesses={businesses}
              value={selectedBusinessId}
              onChange={(businessId) => void setSelectedBusinessId(businessId)}
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
