"use client";

import { FormEvent, useState, type ReactNode } from "react";
import PanelLayout from "@/components/PanelLayout";
import { AddAdAccountForm } from "@/components/selectors/AddAdAccountForm";
import { AdAccountSelector } from "@/components/selectors/AdAccountSelector";
import { FirmSelector } from "@/components/selectors/FirmSelector";
import { SectionCard } from "@/components/shared/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="space-y-6">
      <SectionCard
        title="İşletme Bağlantısı"
        description="Her işletme için ayrı erişim tokenı ekleyin. Reklam hesaplarını Meta ID ile manuel bağlarsınız."
        actions={
          <Badge variant={status?.connected ? "success" : "muted"}>
            {connections.length > 0 ? `${connections.length} işletme` : "Bağlı değil"}
          </Badge>
        }
      >
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

            <Button type="submit" disabled={connecting}>
              {connecting ? "Bağlanıyor..." : "İşletme Bağla"}
            </Button>
          </form>
      </SectionCard>

      {status?.connected && activeConnectionId && (
        <SectionCard
          title="Reklam Hesapları"
          description="İşletme seçin ve reklam hesaplarını Meta ID ile ekleyin. Business eşleşmesi otomatik yapılır."
        >
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
        </SectionCard>
      )}
    </div>
  );
}

export default function SettingsContent() {
  return (
    <PanelLayout
      title="Ayarlar"
      subtitle="Meta bağlantıları ve reklam hesaplarını yönetin"
      showAccountBar={false}
    >
      <SettingsBody />
    </PanelLayout>
  );
}
