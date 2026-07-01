"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ParsedInsights, QuickDateFilter } from "@/types/meta";
import { fetchAccountInsights } from "@/services/meta/client";
import { getDateRangeForQuickFilter } from "@/utils/date-ranges";

export function useAccountInsights(accountKey: string, enabled: boolean, quickFilter: QuickDateFilter) {
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
      const range = getDateRangeForQuickFilter(quickFilter);
      const params =
        range.datePreset && quickFilter !== "this_month"
          ? { datePreset: range.datePreset }
          : { since: range.since, until: range.until, datePreset: range.datePreset };

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
  }, [enabled, quickFilter]);

  useEffect(() => {
    void load();
  }, [load, accountKey]);

  return { insights, loading, error, reload: load };
}
