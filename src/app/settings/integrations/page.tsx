"use client";

import { FormEvent, useEffect, useState } from "react";
import PanelLayout from "@/components/PanelLayout";

type MetaStatus = {
  connected: boolean;
  metaUserId: string | null;
  selectedAdAccountId: string | null;
  selectedAdAccountName: string | null;
};

export default function IntegrationsPage() {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/meta/status");
        const data = (await res.json()) as MetaStatus & { error?: string };
        if (res.ok) {
          setStatus(data);
          if (data.selectedAdAccountId) {
            setAdAccountId(data.selectedAdAccountId);
          }
        } else {
          setError(data.error ?? "Durum bilgisi yuklenemedi");
        }
      } catch {
        setError("Veriler yuklenirken bir hata olustu");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleConnect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setConnecting(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/meta/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, adAccountId }),
      });
      const data = (await res.json()) as MetaStatus & { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Baglanti kurulamadi");
        return;
      }

      setStatus({
        connected: true,
        metaUserId: data.metaUserId ?? null,
        selectedAdAccountId: data.selectedAdAccountId ?? null,
        selectedAdAccountName: data.selectedAdAccountName ?? null,
      });
      setAccessToken("");
      setMessage("Meta hesabi basariyla baglandi.");
    } catch {
      setError("Baglanti kurulurken bir hata olustu");
    } finally {
      setConnecting(false);
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
      setAccessToken("");
      setAdAccountId("");
      setMessage("Meta baglantisi kaldirildi.");
    } catch {
      setError("Baglanti kaldirilirken bir hata olustu");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <PanelLayout title="Entegrasyonlar">
      <div className="max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Meta Ads</h2>
            <p className="mt-1 text-sm text-gray-500">
              Access Token ve Reklam Hesabı ID ile bağlanın.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              status?.connected
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {status?.connected ? "Bagli" : "Bagli Degil"}
          </span>
        </div>

        {loading && <p className="text-sm text-gray-500">Yukleniyor...</p>}

        {message && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {status?.connected && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            <p>
              <span className="font-medium text-gray-700">Reklam hesabi:</span>{" "}
              {status.selectedAdAccountName ?? "—"} ({status.selectedAdAccountId ?? "—"})
            </p>
            {status.metaUserId && (
              <p className="mt-1">
                <span className="font-medium text-gray-700">Meta kullanici ID:</span>{" "}
                {status.metaUserId}
              </p>
            )}
          </div>
        )}

        {!loading && (
          <form onSubmit={handleConnect} className="space-y-3">
            <div>
              <label htmlFor="accessToken" className="mb-1 block text-sm font-medium text-gray-700">
                Meta Access Token
              </label>
              <input
                id="accessToken"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="EAAxxxx..."
                required={!status?.connected}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">
                Nereden:{" "}
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  Graph API Explorer
                </a>
                {" → "}
                <a
                  href="https://developers.facebook.com/docs/graph-api/overview#access-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  Access Token rehberi
                </a>
              </p>
              <p className="text-xs text-gray-500">
                İzinler: <code className="rounded bg-gray-100 px-1">ads_read</code>,{" "}
                <code className="rounded bg-gray-100 px-1">ads_management</code> → Generate Access
                Token
              </p>
            </div>

            <div>
              <label htmlFor="adAccountId" className="mb-1 block text-sm font-medium text-gray-700">
                Reklam Hesabı ID
              </label>
              <input
                id="adAccountId"
                type="text"
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value)}
                placeholder="act_123456789"
                required={!status?.connected}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">
                Nereden:{" "}
                <a
                  href="https://business.facebook.com/settings/ad-accounts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  Business Manager → Reklam Hesapları
                </a>
                {" → hesap adının altındaki "}
                <code className="rounded bg-gray-100 px-1">act_...</code> ID
              </p>
              <p className="text-xs text-gray-500">
                Sadece rakam girerseniz <code className="rounded bg-gray-100 px-1">act_</code> öneki
                otomatik eklenir.
              </p>
            </div>

            <button
              type="submit"
              disabled={connecting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connecting ? "Baglaniyor..." : status?.connected ? "Baglantiyi Guncelle" : "Meta Hesabini Bagla"}
            </button>
          </form>
        )}

        {!loading && status?.connected && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {disconnecting ? "Kaldiriliyor..." : "Baglantiyi Kaldir"}
          </button>
        )}
      </div>
    </PanelLayout>
  );
}
