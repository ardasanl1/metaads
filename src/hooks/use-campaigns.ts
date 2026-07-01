"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { CampaignFilters, CampaignSortField, CampaignWithInsights, SortDirection } from "@/types/meta";
import { fetchCampaigns, type InsightsParams } from "@/services/meta/client";
import {
  filterCampaigns,
  getDefaultCampaignFilters,
  sortCampaigns,
} from "@/utils/campaign-filters";
import { getDateRangeForQuickFilter } from "@/utils/date-ranges";

export function useCampaigns(accountKey: string, enabled: boolean) {
  const [campaigns, setCampaigns] = useState<CampaignWithInsights[]>([]);
  const [filters, setFilters] = useState<CampaignFilters>(getDefaultCampaignFilters);
  const [sortField, setSortField] = useState<CampaignSortField>("spend");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildInsightsParams = useCallback((): InsightsParams => {
    const range = getDateRangeForQuickFilter(filters.quickDateFilter);
    if (range.datePreset && filters.quickDateFilter !== "this_month") {
      return { datePreset: range.datePreset };
    }
    return {
      since: filters.since || range.since,
      until: filters.until || range.until,
      datePreset: range.datePreset,
    };
  }, [filters]);

  const load = useCallback(async () => {
    if (!enabled) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchCampaigns(buildInsightsParams());
      setCampaigns(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kampanyalar yüklenemedi";
      setError(message);
      toast.error(message);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, buildInsightsParams]);

  useEffect(() => {
    void load();
  }, [load, accountKey]);

  const filtered = filterCampaigns(campaigns, filters);
  const sorted = sortCampaigns(filtered, sortField, sortDirection);

  const toggleSort = (field: CampaignSortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("desc");
  };

  return {
    campaigns: sorted,
    allCampaigns: campaigns,
    filters,
    setFilters,
    sortField,
    sortDirection,
    toggleSort,
    loading,
    error,
    reload: load,
  };
}
