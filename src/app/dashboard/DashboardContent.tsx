"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PanelLayout from "@/components/PanelLayout";
import { formatMetaDate, metaStatusColor } from "@/lib/status-utils";

const EMPTY = "—";

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

export default function DashboardContent() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [canFetchCampaigns, setCanFetchCampaigns] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const statusRes = await fetch("/api/meta/status");
        const statusData = (await statusRes.json()) as MetaStatus;

        const ready =
          statusData.connected && Boolean(statusData.selectedAdAccountId);
        setCanFetchCampaigns(ready);

        if (!ready) {
          setCampaigns([]);
          return;
        }

        const campaignsRes = await fetch("/api/meta/campaigns");
        const campaignsData = (await campaignsRes.json()) as {
          campaigns?: Campaign[];
        };
        if (campaignsRes.ok) {
          setCampaigns(campaignsData.campaigns ?? []);
        } else {
          setCampaigns([]);
        }
      } catch {
        setCampaigns([]);
        setCanFetchCampaigns(false);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeCount = canFetchCampaigns
    ? campaigns.filter((c) => c.status === "ACTIVE").length
    : null;

  const stats = [
    {
      label: "Toplam Kampanya",
      value:
        loading ? "…" : canFetchCampaigns ? String(campaigns.length) : EMPTY,
    },
    {
      label: "Aktif Kampanya",
      value:
        loading
          ? "…"
          : canFetchCampaigns && activeCount !== null
            ? String(activeCount)
            : EMPTY,
    },
    { label: "Günlük Bütçe", value: EMPTY },
    { label: "Toplam Lead", value: EMPTY },
  ];

  const recentCampaigns = campaigns.slice(0, 5);

  return (
    <PanelLayout title="Genel Bakış">
      <div className="space-y-6">
        {!loading && !canFetchCampaigns && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Özet verileri görmek için Meta hesabını bağlayın ve bir reklam hesabı seçin.{" "}
            <Link href="/settings/integrations" className="text-blue-600 hover:text-blue-800">
              Entegrasyonlara git
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5"
            >
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Son Kampanyalar</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Kampanya</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Hedef</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Durum</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Gerçek Durum</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Güncellenme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      Yükleniyor…
                    </td>
                  </tr>
                ) : recentCampaigns.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-gray-400">{EMPTY}</td>
                    <td className="px-4 py-3 text-gray-400">{EMPTY}</td>
                    <td className="px-4 py-3 text-gray-400">{EMPTY}</td>
                    <td className="px-4 py-3 text-gray-400">{EMPTY}</td>
                    <td className="px-4 py-3 text-gray-400">{EMPTY}</td>
                  </tr>
                ) : (
                  recentCampaigns.map((campaign) => (
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PanelLayout>
  );
}
