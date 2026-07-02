"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { toast } from "sonner";
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

const META_TOKEN_PERMISSIONS = [
  "ads_read",
  "ads_management",
  "business_management",
  "pages_show_list",
  "pages_manage_ads",
] as const;

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

function SettingsBody() {
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
  const [metaBusinessId, setMetaBusinessId] = useState("");
  const [savingBusinessId, setSavingBusinessId] = useState(false);
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
        body: JSON.stringify({
          accessToken,
          metaBusinessId: metaBusinessId.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Bağlantı kurulamadı");
        return;
      }

      setAccessToken("");
      setMetaBusinessId("");
      setMessage("İşletme bağlandı. Aşağıdan reklam hesabı ekleyebilirsiniz.");
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

  async function handleSaveBusinessId() {
    if (!activeConnectionId) return;
    const trimmed = metaBusinessId.trim();
    if (!trimmed) {
      toast.error("Business Manager ID girin");
      return;
    }

    setSavingBusinessId(true);
    setError("");
    try {
      const res = await fetch("/api/meta/connections/business-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: activeConnectionId, metaBusinessId: trimmed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Business ID kaydedilemedi");
        return;
      }
      setMessage("Business Manager ID kaydedildi.");
      retry();
    } catch {
      setError("Business ID kaydedilirken hata oluştu");
    } finally {
      setSavingBusinessId(false);
    }
  }

  const activeConnection = connections.find((item) => item.id === activeConnectionId) ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>İşletme Bağlantısı</CardTitle>
            <CardDescription className="mt-1">
              Her işletme için ayrı erişim tokenı ekleyin. Reklam hesaplarını Meta ID ile manuel
              bağlarsınız.
            </CardDescription>
          </div>
          <Badge variant={status?.connected ? "success" : "muted"}>
            {connections.length > 0 ? `${connections.length} işletme` : "Bağlı değil"}
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
                İşletme Erişim Tokenı
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
                Nereden:{" "}
                <ExternalLink href="https://developers.facebook.com/tools/explorer/">
                  Graph API Explorer
                </ExternalLink>
                {" → "}
                <ExternalLink href="https://developers.facebook.com/docs/graph-api/overview#access-tokens">
                  Access Token rehberi
                </ExternalLink>
              </p>
              <p className="text-xs text-muted-foreground">
                Kalıcı kullanım için:{" "}
                <ExternalLink href="https://business.facebook.com/settings/system-users">
                  Business Manager → System Users
                </ExternalLink>
                {" "}üzerinden işletme tokenı oluşturun.
              </p>
              <p className="text-xs text-muted-foreground">
                Gerekli izinler:{" "}
                {META_TOKEN_PERMISSIONS.map((permission) => (
                  <code key={permission} className="mr-1 rounded bg-muted px-1 py-0.5 text-[11px]">
                    {permission}
                  </code>
                ))}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="metaBusinessId" className="text-sm font-medium text-foreground">
                Business Manager ID (opsiyonel)
              </label>
              <Input
                id="metaBusinessId"
                value={metaBusinessId}
                onChange={(e) => setMetaBusinessId(e.target.value)}
                placeholder="ör. 123456789012345"
                autoComplete="off"
                className="bg-background text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Nereden:{" "}
                <ExternalLink href="https://business.facebook.com/settings/info">
                  Business Manager → İşletme bilgileri
                </ExternalLink>
                {" → "}
                <strong>İşletme kimliği</strong>. Bu, reklam hesabı ID&apos;si (
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">act_...</code>) değildir.
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
              İşletme seçin ve reklam hesaplarını Meta ID ile ekleyin. Hesaplar otomatik listelenmez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
            </div>
            <AddAdAccountForm onAdd={addAdAccountManually} disabled={accountLoading} />

            {activeConnection && !activeConnection.metaBusinessId && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/50 dark:bg-yellow-950/30">
                <p className="text-sm text-yellow-900 dark:text-yellow-200">
                  Business Manager ID kayıtlı değil. Reklam hesabı eklediyseniz sistem otomatik
                  çözmeyi dener; olmazsa aşağıya Business Manager ID girin.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Business Manager ID
                    </label>
                    <Input
                      value={metaBusinessId}
                      onChange={(e) => setMetaBusinessId(e.target.value)}
                      placeholder="123456789012345"
                      className="bg-background text-foreground"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingBusinessId}
                    onClick={() => void handleSaveBusinessId()}
                  >
                    {savingBusinessId ? "Kaydediliyor..." : "Business ID Kaydet"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SettingsContent() {
  return (
    <PanelLayout title="Ayarlar">
      <SettingsBody />
    </PanelLayout>
  );
}
