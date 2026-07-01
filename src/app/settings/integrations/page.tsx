"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import PanelLayout from "@/components/PanelLayout";

type MetaStatus = {
  connected: boolean;
  metaUserId: string | null;
  selectedAdAccountId: string | null;
  selectedAdAccountName: string | null;
};

type MetaSettings = {
  configured: boolean;
  appId: string;
  hasAppSecret: boolean;
  redirectUri: string;
  apiVersion: string;
};

type MetaSettingsForm = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  apiVersion: string;
};

type AdAccount = {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
};

const EMPTY_FORM: MetaSettingsForm = {
  appId: "",
  appSecret: "",
  redirectUri: "",
  apiVersion: "v23.0",
};

function getIntegrationStatusLabel(
  settings: MetaSettings | null,
  status: MetaStatus | null,
): string {
  if (!settings?.configured) return "Yapilandirilmadi";
  if (status?.connected) return "Bagli";
  return "Bagli Degil";
}

function getIntegrationStatusClass(
  settings: MetaSettings | null,
  status: MetaStatus | null,
): string {
  if (!settings?.configured) {
    return "bg-yellow-100 text-yellow-800";
  }
  if (status?.connected) {
    return "bg-green-100 text-green-800";
  }
  return "bg-gray-100 text-gray-600";
}

function IntegrationsPanel() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [settings, setSettings] = useState<MetaSettings | null>(null);
  const [form, setForm] = useState<MetaSettingsForm>(EMPTY_FORM);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const productionRedirectSuggestion =
    typeof window === "undefined"
      ? "https://MEVCUT-DOMAIN/api/meta/callback"
      : window.location.origin.includes("localhost")
        ? "https://MEVCUT-DOMAIN/api/meta/callback"
        : `${window.location.origin}/api/meta/callback`;

  useEffect(() => {
    const connected = searchParams.get("connected");
    const err = searchParams.get("error");

    if (connected === "1") {
      setMessage("Meta hesabi basariyla baglandi.");
    }

    if (err === "missing_code") {
      setError("Meta yetkilendirme kodu alinamadi.");
    } else if (err === "invalid_state") {
      setError("OAuth dogrulamasi basarisiz oldu.");
    } else if (err === "oauth_failed") {
      setError("Meta baglantisi kurulamadi.");
    } else if (err === "meta-config-missing") {
      setError("Meta ayarlari eksik. Once uygulama bilgilerini kaydedin.");
    }
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const [settingsRes, statusRes] = await Promise.all([
          fetch("/api/meta/settings"),
          fetch("/api/meta/status"),
        ]);

        const settingsData = (await settingsRes.json()) as MetaSettings & { error?: string };
        const statusData = (await statusRes.json()) as MetaStatus & { error?: string };

        if (!settingsRes.ok) {
          setError(settingsData.error ?? "Meta ayarlari yuklenemedi");
          return;
        }

        if (!statusRes.ok) {
          setError(statusData.error ?? "Meta durum bilgisi yuklenemedi");
          return;
        }

        setSettings(settingsData);
        setForm({
          appId: settingsData.appId,
          appSecret: "",
          redirectUri: settingsData.redirectUri,
          apiVersion: settingsData.apiVersion,
        });
        setStatus(statusData);

        if (statusData.connected) {
          const accountsRes = await fetch("/api/meta/ad-accounts");
          const accountsData = (await accountsRes.json()) as {
            accounts?: AdAccount[];
            error?: string;
          };

          if (accountsRes.ok) {
            setAccounts(accountsData.accounts ?? []);
            setSelectedId(statusData.selectedAdAccountId ?? "");
          } else {
            setError(accountsData.error ?? "Reklam hesaplari yuklenemedi");
          }
        } else {
          setAccounts([]);
          setSelectedId("");
        }
      } catch {
        setError("Veriler yuklenirken bir hata olustu");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function updateForm<K extends keyof MetaSettingsForm>(key: K, value: MetaSettingsForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingSettings(true);
    setFormError("");
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/meta/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as MetaSettings & { error?: string };

      if (!res.ok) {
        setFormError(data.error ?? "Meta ayarlari kaydedilemedi");
        return;
      }

      setSettings(data);
      setForm((prev) => ({ ...prev, appSecret: "" }));
      setMessage("Meta ayarlari kaydedildi.");
    } catch {
      setFormError("Meta ayarlari kaydedilirken bir hata olustu");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const account = accounts.find((item) => item.id === selectedId);
    if (!account) return;

    setSavingAccount(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/meta/ad-accounts/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, accountName: account.name }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Secim kaydedilemedi");
        return;
      }

      setMessage("Reklam hesabi secimi kaydedildi.");
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              selectedAdAccountId: account.id,
              selectedAdAccountName: account.name,
            }
          : prev,
      );
    } catch {
      setError("Secim kaydedilirken bir hata olustu");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Meta baglantisini kaldirmak istediginize emin misiniz?")) return;

    setDisconnecting(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/meta/disconnect", { method: "POST" });
      if (!res.ok) {
        setError("Baglanti kaldirilamadi");
        return;
      }

      setStatus({
        connected: false,
        metaUserId: null,
        selectedAdAccountId: null,
        selectedAdAccountName: null,
      });
      setAccounts([]);
      setSelectedId("");
      setMessage("Meta baglantisi kaldirildi.");
    } catch {
      setError("Baglanti kaldirilirken bir hata olustu");
    } finally {
      setDisconnecting(false);
    }
  }

  const connectDisabled = !settings?.configured;
  const statusLabel = getIntegrationStatusLabel(settings, status);
  const statusClassName = getIntegrationStatusClass(settings, status);

  return (
    <PanelLayout title="Entegrasyonlar">
      <div className="max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Meta Ads</h2>
            <p className="mt-1 text-sm text-gray-500">
              Meta uygulama bilgilerini kaydedin ve reklam hesabinizi baglayin.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              <a
                href="https://developers.facebook.com/apps/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                Kurulum rehberi (My Apps)
              </a>
              {" · "}
              <a
                href="https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                Redirect URI dokumantasyonu
              </a>
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClassName}`}
          >
            {statusLabel}
          </span>
        </div>

        {loading && <p className="text-sm text-gray-500">Yukleniyor...</p>}

        {message && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {!loading && (
          <form onSubmit={handleSaveSettings} className="space-y-3 rounded-lg border border-gray-200 p-4">
            <div>
              <label htmlFor="appId" className="mb-1 block text-sm font-medium text-gray-700">
                Meta App ID
              </label>
              <input
                id="appId"
                type="text"
                value={form.appId}
                onChange={(e) => updateForm("appId", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">
                Nereden:{" "}
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  My Apps
                </a>
                {" → Settings → Basic → App ID"}
              </p>
            </div>

            <div>
              <label htmlFor="appSecret" className="mb-1 block text-sm font-medium text-gray-700">
                Meta App Secret
              </label>
              <input
                id="appSecret"
                type="password"
                value={form.appSecret}
                onChange={(e) => updateForm("appSecret", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoComplete="new-password"
              />
              {settings?.hasAppSecret && (
                <p className="mt-1 text-xs text-gray-500">
                  App Secret kayitli. Degistirmek istemiyorsaniz bos birakin.
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Nereden:{" "}
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  My Apps
                </a>
                {" → Settings → Basic → App Secret → Show"}
              </p>
            </div>

            <div>
              <label
                htmlFor="redirectUri"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Redirect URI
              </label>
              <input
                id="redirectUri"
                type="url"
                value={form.redirectUri}
                onChange={(e) => updateForm("redirectUri", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">
                Local: http://localhost:3000/api/meta/callback
              </p>
              <p className="text-xs text-gray-500">
                Production: {productionRedirectSuggestion}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Nereden: Facebook Login → Settings →{" "}
                <a
                  href="https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  Valid OAuth Redirect URIs
                </a>
              </p>
            </div>

            <div>
              <label
                htmlFor="apiVersion"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                API Version
              </label>
              <input
                id="apiVersion"
                type="text"
                value={form.apiVersion}
                onChange={(e) => updateForm("apiVersion", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">
                Ornek: v23.0 —{" "}
                <a
                  href="https://developers.facebook.com/docs/graph-api/changelog"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  Graph API surumleri
                </a>
              </p>
            </div>

            {formError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
            )}

            <button
              type="submit"
              disabled={savingSettings}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSettings ? "Kaydediliyor..." : "Meta Ayarlarini Kaydet"}
            </button>
          </form>
        )}

        {!loading && !status?.connected && (
          <a
            href="/api/meta/connect"
            aria-disabled={connectDisabled}
            className={`inline-block rounded-lg px-4 py-2 text-sm font-medium text-white ${
              connectDisabled
                ? "pointer-events-none bg-gray-300 text-gray-600"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            Meta Hesabini Bagla
          </a>
        )}

        {!loading && status?.connected && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-700">Meta Kullanici ID:</span>{" "}
                {status.metaUserId ?? "-"}
              </p>
              <p className="mt-1">
                <span className="font-medium text-gray-700">Secili reklam hesabi:</span>{" "}
                {status.selectedAdAccountName
                  ? `${status.selectedAdAccountName} (${status.selectedAdAccountId})`
                  : "-"}
              </p>
            </div>

            {accounts.length > 0 ? (
              <form onSubmit={handleSaveAccount} className="space-y-3">
                <div>
                  <label
                    htmlFor="adAccount"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Reklam Hesabi
                  </label>
                  <select
                    id="adAccount"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seciniz</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!selectedId || savingAccount}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAccount ? "Kaydediliyor..." : "Secimi Kaydet"}
                </button>
              </form>
            ) : (
              <p className="text-sm text-gray-500">Erisilebilir reklam hesabi bulunamadi.</p>
            )}

            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {disconnecting ? "Kaldiriliyor..." : "Baglantiyi Kaldir"}
            </button>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsPanel />
    </Suspense>
  );
}
