"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PanelLayout from "@/components/PanelLayout";
import { formatMetaDate, metaStatusColor } from "@/lib/status-utils";

type MetaStatus = {
  connected: boolean;
  selectedAdAccountId: string | null;
};

type Campaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  updated_time: string;
};

export default function CampaignsContent() {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const statusRes = await fetch("/api/meta/status");
        const statusData = (await statusRes.json()) as MetaStatus;
        setStatus(statusData);

        if (!statusData.connected) {
          setCampaigns([]);
          return;
        }
        if (!statusData.selectedAdAccountId) {
          setCampaigns([]);
          return;
        }

        const campaignsRes = await fetch("/api/meta/campaigns");
        const campaignsData = (await campaignsRes.json()) as {
          campaigns?: Campaign[];
          error?: string;
        };
        if (!campaignsRes.ok) {
          setError(campaignsData.error ?? "Kampanyalar yüklenemedi");
          return;
        }
        setCampaigns(campaignsData.campaigns ?? []);
      } catch {
        setError("Veriler yüklenirken bir hata oluştu");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <PanelLayout title="Kampanyalar">
      <div className="space-y-4">
        <div className="flex justify-end">
          {status?.connected && status.selectedAdAccountId ? (
            <Link
              href="/campaigns/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Yeni Kampanya
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title={
                !status?.connected
                  ? "Önce Meta hesabını bağlayın"
                  : "Reklam hesabı bilgisi eksik"
              }
              className="cursor-not-allowed rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-500"
            >
              Yeni Kampanya
            </button>
          )}
        </div>

        {loading && (
          <p className="text-sm text-gray-500">Kampanyalar yükleniyor...</p>
        )}

        {!loading && status && !status.connected && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 sm:p-6">
            <p className="text-sm text-yellow-900">
              Gerçek kampanyaları görmek için Meta hesabını bağla.
            </p>
            <Link
              href="/settings/integrations"
              className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Entegrasyonlara Git
            </Link>
          </div>
        )}

        {!loading && status?.connected && !status.selectedAdAccountId && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 sm:p-6">
            <p className="text-sm text-yellow-900">
              Kampanyaları görmek için bir reklam hesabı seçin.
            </p>
            <Link
              href="/settings/integrations"
              className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Entegrasyonlara Git
            </Link>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {!loading && status?.connected && status.selectedAdAccountId && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Kampanya</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Hedef</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Durum</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Gerçek Durum</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Güncellenme</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Yönet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                      Kampanya bulunamadı
                    </td>
                  </tr>
                ) : (
                  campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{campaign.name}</td>
                      <td className="px-4 py-3 text-gray-600">{campaign.objective}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${metaStatusColor(campaign.status)}`}
                        >
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${metaStatusColor(campaign.effective_status)}`}
                        >
                          {campaign.effective_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatMetaDate(campaign.updated_time)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/campaigns/${campaign.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Yönet
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}
