"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ParsedInsights } from "@/types/meta";
import { fetchAccountInsights } from "@/services/meta/client";
import { buildInsightsParamsFromQuickFilter } from "@/utils/date-ranges";
import type { DateFilterState } from "@/hooks/use-date-filter";

export function useAccountInsights(
  accountKey: string,
  enabled: boolean,
  dateFilter: DateFilterState,
) {
  const { quickDateFilter, since, until } = dateFilter;

  const [insights, setInsights] = useState<ParsedInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setInsights(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = buildInsightsParamsFromQuickFilter(quickDateFilter, since, until);
      const data = await fetchAccountInsights(params);
      setInsights(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "İstatistikler yüklenemedi";
      setError(message);
      toast.error(message);
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, quickDateFilter, since, until]);

  useEffect(() => {
    void load();
  }, [load, accountKey, quickDateFilter, since, until]);

  return { insights, loading, error, reload: load };
}
