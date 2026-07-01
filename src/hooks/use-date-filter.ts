"use client";

import { useCallback, useMemo, useState } from "react";
import type { QuickDateFilter } from "@/types/meta";
import {
  applyQuickDateFilter,
  buildInsightsParamsFromQuickFilter,
  getDateRangeForQuickFilter,
} from "@/utils/date-ranges";

export type DateFilterState = {
  quickDateFilter: QuickDateFilter;
  since: string;
  until: string;
};

export function getDefaultDateFilter(): DateFilterState {
  const range = getDateRangeForQuickFilter("last_7_days");
  return {
    quickDateFilter: "last_7_days",
    since: range.since,
    until: range.until,
  };
}

export function useDateFilter(initial?: DateFilterState) {
  const [state, setState] = useState<DateFilterState>(initial ?? getDefaultDateFilter);

  const insightsParams = useMemo(
    () => buildInsightsParamsFromQuickFilter(state.quickDateFilter, state.since, state.until),
    [state.quickDateFilter, state.since, state.until],
  );

  const applyQuickFilter = useCallback((filter: QuickDateFilter) => {
    const next = applyQuickDateFilter(
      { search: "", status: "all", objective: "all" },
      filter,
    );
    setState({
      quickDateFilter: next.quickDateFilter,
      since: next.since,
      until: next.until,
    });
  }, []);

  const setCustomRange = useCallback((since: string, until: string) => {
    setState({
      quickDateFilter: "custom",
      since,
      until,
    });
  }, []);

  return {
    ...state,
    insightsParams,
    applyQuickFilter,
    setCustomRange,
    setState,
  };
}
