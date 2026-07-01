"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  AdSetWithInsights,
  AdWithInsights,
  CampaignWithInsights,
} from "@/types/meta";
import {
  fetchAdSets,
  fetchAds,
  fetchCampaign,
  updateAd,
  updateAdSet,
  updateCampaign,
} from "@/services/meta/client";
import type { DateFilterState } from "@/hooks/use-date-filter";
import { buildInsightsParamsFromQuickFilter } from "@/utils/date-ranges";

type PendingAction =
  | { type: "campaign-name"; name: string }
  | { type: "campaign-status"; status: "ACTIVE" | "PAUSED" }
  | { type: "adset-name"; id: string; name: string }
  | { type: "adset-status"; id: string; status: "ACTIVE" | "PAUSED" }
  | { type: "adset-budget"; id: string; dailyBudget: number }
  | { type: "ad-name"; id: string; name: string }
  | { type: "ad-status"; id: string; status: "ACTIVE" | "PAUSED" };

export function useCampaignDetail(
  campaignId: string,
  enabled: boolean,
  dateFilter: DateFilterState,
  accountKey: string,
) {
  const [campaign, setCampaign] = useState<CampaignWithInsights | null>(null);
  const [adsets, setAdsets] = useState<AdSetWithInsights[]>([]);
  const [ads, setAds] = useState<AdWithInsights[]>([]);
  const [selectedAdSetId, setSelectedAdSetId] = useState("");
  const [loading, setLoading] = useState(true);
  const [adsLoading, setAdsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const buildParams = useCallback(
    () =>
      buildInsightsParamsFromQuickFilter(
        dateFilter.quickDateFilter,
        dateFilter.since,
        dateFilter.until,
      ),
    [dateFilter.quickDateFilter, dateFilter.since, dateFilter.until],
  );

  const loadCampaign = useCallback(async () => {
    const data = await fetchCampaign(campaignId, buildParams());
    setCampaign(data);
  }, [campaignId, buildParams]);

  const loadAdSets = useCallback(async () => {
    const data = await fetchAdSets(campaignId, buildParams());
    setAdsets(data);
    setSelectedAdSetId((current) => {
      if (current && data.some((item) => item.id === current)) return current;
      return data[0]?.id ?? "";
    });
  }, [campaignId, buildParams]);

  const loadAds = useCallback(
    async (adSetId: string) => {
      if (!adSetId) return;
      setAdsLoading(true);
      try {
        const data = await fetchAds(adSetId, buildParams());
        setAds(data);
      } finally {
        setAdsLoading(false);
      }
    },
    [buildParams],
  );

  const reloadAll = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      await loadCampaign();
      await loadAdSets();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Veriler yüklenemedi";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [enabled, loadCampaign, loadAdSets]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll, accountKey, dateFilter.quickDateFilter, dateFilter.since, dateFilter.until]);

  useEffect(() => {
    if (selectedAdSetId) {
      loadAds(selectedAdSetId).catch((err) => {
        const message = err instanceof Error ? err.message : "Reklamlar yüklenemedi";
        setError(message);
        toast.error(message);
      });
    } else {
      setAds([]);
    }
  }, [selectedAdSetId, loadAds, dateFilter.quickDateFilter, dateFilter.since, dateFilter.until]);

  const executePending = useCallback(
    async (pending: PendingAction) => {
      setSubmitting(true);
      setError(null);
      try {
        if (pending.type === "campaign-name") {
          await updateCampaign(campaignId, { name: pending.name });
          await loadCampaign();
        } else if (pending.type === "campaign-status") {
          await updateCampaign(campaignId, { status: pending.status });
          await loadCampaign();
        } else if (pending.type === "adset-name") {
          await updateAdSet(pending.id, { name: pending.name });
          await loadAdSets();
        } else if (pending.type === "adset-status") {
          await updateAdSet(pending.id, { status: pending.status });
          await loadAdSets();
        } else if (pending.type === "adset-budget") {
          await updateAdSet(pending.id, { dailyBudget: pending.dailyBudget });
          await loadAdSets();
        } else if (pending.type === "ad-name") {
          await updateAd(pending.id, { name: pending.name });
          await loadAds(selectedAdSetId);
        } else if (pending.type === "ad-status") {
          await updateAd(pending.id, { status: pending.status });
          await loadAds(selectedAdSetId);
        }
        toast.success("Değişiklik Meta hesabına uygulandı.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Güncelleme başarısız";
        setError(message);
        toast.error(message);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [campaignId, loadCampaign, loadAdSets, loadAds, selectedAdSetId],
  );

  return {
    campaign,
    adsets,
    ads,
    selectedAdSetId,
    setSelectedAdSetId,
    loading,
    adsLoading,
    error,
    submitting,
    executePending,
    reload: reloadAll,
  };
}

export type { PendingAction };
