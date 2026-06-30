"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PanelLayout from "@/components/PanelLayout";
import { dailyBudgetFromMeta, formatMetaDate, metaStatusColor } from "@/lib/status-utils";

type Campaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  updated_time: string;
};

type AdSet = {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

type Ad = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  updated_time: string;
  creative?: { id: string; name?: string; thumbnail_url?: string };
};

type PendingAction =
  | { type: "campaign-name"; name: string }
  | { type: "campaign-status"; status: "ACTIVE" | "PAUSED" }
  | { type: "adset-name"; id: string; name: string }
  | { type: "adset-status"; id: string; status: "ACTIVE" | "PAUSED" }
  | { type: "adset-budget"; id: string; dailyBudget: number }
  | { type: "ad-name"; id: string; name: string }
  | { type: "ad-status"; id: string; status: "ACTIVE" | "PAUSED" };

export default function CampaignDetailContent() {
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [adsets, setAdsets] = useState<AdSet[]>([]);
  const [selectedAdSetId, setSelectedAdSetId] = useState("");
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [campaignName, setCampaignName] = useState("");
  const [editAdSetId, setEditAdSetId] = useState<string | null>(null);
  const [adSetName, setAdSetName] = useState("");
  const [adSetBudget, setAdSetBudget] = useState("");
  const [editAdId, setEditAdId] = useState<string | null>(null);
  const [adName, setAdName] = useState("");

  const loadCampaign = useCallback(async () => {
    const res = await fetch("/api/meta/campaigns");
    const data = (await res.json()) as { campaigns?: Campaign[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Kampanya yüklenemedi");
    const found = data.campaigns?.find((c) => c.id === campaignId);
    if (!found) throw new Error("Kampanya bulunamadı");
    setCampaign(found);
    setCampaignName(found.name);
  }, [campaignId]);

  const loadAdSets = useCallback(async () => {
    const res = await fetch(`/api/meta/adsets?campaignId=${campaignId}`);
    const data = (await res.json()) as { adsets?: AdSet[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Reklam setleri yüklenemedi");
    setAdsets(data.adsets ?? []);
    if (data.adsets?.length && !selectedAdSetId) {
      setSelectedAdSetId(data.adsets[0].id);
    }
  }, [campaignId, selectedAdSetId]);

  const loadAds = useCallback(async (adSetId: string) => {
    if (!adSetId) return;
    const res = await fetch(`/api/meta/ads?adSetId=${adSetId}`);
    const data = (await res.json()) as { ads?: Ad[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Reklamlar yüklenemedi");
    setAds(data.ads ?? []);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError("");
      try {
        await loadCampaign();
        await loadAdSets();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Veriler yüklenemedi");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [loadCampaign, loadAdSets]);

  useEffect(() => {
    if (selectedAdSetId) {
      loadAds(selectedAdSetId).catch((err) => {
        setError(err instanceof Error ? err.message : "Reklamlar yüklenemedi");
      });
    }
  }, [selectedAdSetId, loadAds]);

  async function executePending() {
    if (!pending) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (pending.type === "campaign-name") {
        const res = await fetch(`/api/meta/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: pending.name }),
        });
        const data = (await res.json()) as { campaign?: Campaign; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Güncelleme başarısız");
        setCampaign(data.campaign ?? null);
        setCampaignName(data.campaign?.name ?? pending.name);
      } else if (pending.type === "campaign-status") {
        const res = await fetch(`/api/meta/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: pending.status }),
        });
        const data = (await res.json()) as { campaign?: Campaign; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Güncelleme başarısız");
        setCampaign(data.campaign ?? null);
      } else if (pending.type === "adset-name") {
        const res = await fetch(`/api/meta/adsets/${pending.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: pending.name }),
        });
        const data = (await res.json()) as { adset?: AdSet; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Güncelleme başarısız");
        await loadAdSets();
        setEditAdSetId(null);
      } else if (pending.type === "adset-status") {
        const res = await fetch(`/api/meta/adsets/${pending.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: pending.status }),
        });
        const data = (await res.json()) as { adset?: AdSet; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Güncelleme başarısız");
        await loadAdSets();
      } else if (pending.type === "adset-budget") {
        const res = await fetch(`/api/meta/adsets/${pending.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dailyBudget: pending.dailyBudget }),
        });
        const data = (await res.json()) as { adset?: AdSet; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Güncelleme başarısız");
        await loadAdSets();
        setEditAdSetId(null);
      } else if (pending.type === "ad-name") {
        const res = await fetch(`/api/meta/ads/${pending.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: pending.name }),
        });
        const data = (await res.json()) as { ad?: Ad; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Güncelleme başarısız");
        await loadAds(selectedAdSetId);
        setEditAdId(null);
      } else if (pending.type === "ad-status") {
        const res = await fetch(`/api/meta/ads/${pending.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: pending.status }),
        });
        const data = (await res.json()) as { ad?: Ad; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Güncelleme başarısız");
        await loadAds(selectedAdSetId);
      }
      setMessage("Değişiklik Meta hesabına uygulandı.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Güncelleme başarısız");
    } finally {
      setSubmitting(false);
      setPending(null);
    }
  }

  function openAdSetEdit(adset: AdSet) {
    setEditAdSetId(adset.id);
    setAdSetName(adset.name);
    setAdSetBudget(
      adset.daily_budget ? String(Number(adset.daily_budget) / 100) : "",
    );
  }

  function openAdEdit(ad: Ad) {
    setEditAdId(ad.id);
    setAdName(ad.name);
  }

  return (
    <PanelLayout title="Kampanya Detayı">
      <div className="space-y-6">
        <Link href="/campaigns" className="text-sm text-blue-600 hover:text-blue-800">
          ← Kampanyalara dön
        </Link>

        {loading && <p className="text-sm text-gray-500">Yükleniyor...</p>}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {message && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
        )}

        {campaign && (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900">Kampanya</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${metaStatusColor(campaign.status)}`}
                >
                  Durum: {campaign.status}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${metaStatusColor(campaign.effective_status)}`}
                >
                  Gerçek Durum: {campaign.effective_status}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Hedef: {campaign.objective} · Güncellenme: {formatMetaDate(campaign.updated_time)}
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="campaignName" className="mb-1 block text-sm font-medium text-gray-700">
                    Kampanya adı
                  </label>
                  <input
                    id="campaignName"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  disabled={submitting || campaignName === campaign.name}
                  onClick={() => setPending({ type: "campaign-name", name: campaignName })}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Adı Kaydet
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submitting || campaign.status === "ACTIVE"}
                  onClick={() => setPending({ type: "campaign-status", status: "ACTIVE" })}
                  className="rounded-lg border border-green-300 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Aktif Et
                </button>
                <button
                  type="button"
                  disabled={submitting || campaign.status === "PAUSED"}
                  onClick={() => setPending({ type: "campaign-status", status: "PAUSED" })}
                  className="rounded-lg border border-yellow-300 px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Duraklat
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
              <h2 className="mb-3 text-base font-semibold text-gray-900">Reklam Setleri</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Ad</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Durum</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Gerçek Durum</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Günlük Bütçe</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {adsets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                          Reklam seti bulunamadı
                        </td>
                      </tr>
                    ) : (
                      adsets.map((adset) => (
                        <tr
                          key={adset.id}
                          className={selectedAdSetId === adset.id ? "bg-blue-50" : "hover:bg-gray-50"}
                        >
                          <td className="px-3 py-2 font-medium text-gray-900">{adset.name}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${metaStatusColor(adset.status)}`}>
                              {adset.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${metaStatusColor(adset.effective_status)}`}>
                              {adset.effective_status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {dailyBudgetFromMeta(adset.daily_budget)}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setSelectedAdSetId(adset.id)}
                              className="mr-2 text-blue-600 hover:text-blue-800"
                            >
                              Reklamlar
                            </button>
                            <button
                              type="button"
                              onClick={() => openAdSetEdit(adset)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Düzenle
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {editAdSetId && (
                <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h3 className="text-sm font-medium text-gray-900">Reklam Seti Düzenle</h3>
                  <input
                    value={adSetName}
                    onChange={(e) => setAdSetName(e.target.value)}
                    placeholder="Reklam seti adı"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={adSetBudget}
                    onChange={(e) => setAdSetBudget(e.target.value)}
                    placeholder="Günlük bütçe (TL)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        setPending({ type: "adset-name", id: editAdSetId, name: adSetName })
                      }
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Adı Kaydet
                    </button>
                    <button
                      type="button"
                      disabled={submitting || !adSetBudget}
                      onClick={() =>
                        setPending({
                          type: "adset-budget",
                          id: editAdSetId,
                          dailyBudget: Number(adSetBudget),
                        })
                      }
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-white disabled:opacity-60"
                    >
                      Bütçeyi Kaydet
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        setPending({ type: "adset-status", id: editAdSetId, status: "ACTIVE" })
                      }
                      className="rounded-lg border border-green-300 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:opacity-60"
                    >
                      Aktif Et
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        setPending({ type: "adset-status", id: editAdSetId, status: "PAUSED" })
                      }
                      className="rounded-lg border border-yellow-300 px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-50 disabled:opacity-60"
                    >
                      Duraklat
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditAdSetId(null)}
                      className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-white"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedAdSetId && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
                <h2 className="mb-3 text-base font-semibold text-gray-900">Reklamlar</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Ad</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Durum</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Gerçek Durum</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Güncellenme</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {ads.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                            Reklam bulunamadı
                          </td>
                        </tr>
                      ) : (
                        ads.map((ad) => (
                          <tr key={ad.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {ad.creative?.thumbnail_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={ad.creative.thumbnail_url}
                                    alt=""
                                    className="h-8 w-8 rounded object-cover"
                                  />
                                )}
                                <span className="font-medium text-gray-900">{ad.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${metaStatusColor(ad.status)}`}>
                                {ad.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${metaStatusColor(ad.effective_status)}`}>
                                {ad.effective_status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {formatMetaDate(ad.updated_time)}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => openAdEdit(ad)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                Düzenle
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {editAdId && (
                  <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="text-sm font-medium text-gray-900">Reklam Düzenle</h3>
                    <input
                      value={adName}
                      onChange={(e) => setAdName(e.target.value)}
                      placeholder="Reklam adı"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          setPending({ type: "ad-name", id: editAdId, name: adName })
                        }
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        Adı Kaydet
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          setPending({ type: "ad-status", id: editAdId, status: "ACTIVE" })
                        }
                        className="rounded-lg border border-green-300 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:opacity-60"
                      >
                        Aktif Et
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          setPending({ type: "ad-status", id: editAdId, status: "PAUSED" })
                        }
                        className="rounded-lg border border-yellow-300 px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-50 disabled:opacity-60"
                      >
                        Duraklat
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditAdId(null)}
                        className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-white"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {pending && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
              <p className="text-sm text-gray-700">
                Bu değişiklik doğrudan Meta reklam hesabına uygulanacak. Devam edilsin mi?
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setPending(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  İptal
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={executePending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Uygulanıyor..." : "Devam Et"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}
