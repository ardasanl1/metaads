import type { DateRangePreset, QuickDateFilter } from "@/types/meta";

export type DateRange = {
  since: string;
  until: string;
  datePreset?: DateRangePreset;
};

export type InsightsParams = {
  datePreset?: string;
  since?: string;
  until?: string;
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Meta preset kullanan filtreler — takvim/rolling aralık net ayrılır. */
const PRESET_ONLY_FILTERS: QuickDateFilter[] = [
  "today",
  "yesterday",
  "last_7_days",
  "last_14_days",
  "this_month",
  "last_month",
];

export function getDateRangeForQuickFilter(filter: QuickDateFilter): DateRange {
  const today = new Date();
  const todayStr = formatDate(today);

  switch (filter) {
    case "today":
      return { since: todayStr, until: todayStr, datePreset: "today" };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday);
      return { since: yesterdayStr, until: yesterdayStr, datePreset: "yesterday" };
    }
    case "last_7_days":
      return { since: "", until: "", datePreset: "last_7d" };
    case "last_14_days":
      return { since: "", until: "", datePreset: "last_14d" };
    case "this_month":
      return { since: "", until: "", datePreset: "this_month" };
    case "last_month":
      return { since: "", until: "", datePreset: "last_month" };
    case "custom":
    default:
      return { since: "", until: "", datePreset: "custom" };
  }
}

export function getQuickFilterLabel(filter: QuickDateFilter): string {
  const labels: Record<QuickDateFilter, string> = {
    today: "Bugün",
    yesterday: "Dün",
    last_7_days: "Son 7 Gün",
    last_14_days: "Son 14 Gün",
    this_month: "Bu Ay",
    last_month: "Geçen Ay",
    custom: "Özel",
  };
  return labels[filter];
}

export function buildInsightsParamsFromQuickFilter(
  filter: QuickDateFilter,
  customSince?: string,
  customUntil?: string,
): InsightsParams {
  if (filter === "custom") {
    if (customSince && customUntil) {
      return { since: customSince, until: customUntil };
    }
    return { datePreset: "last_7d" };
  }

  const range = getDateRangeForQuickFilter(filter);
  if (range.datePreset && range.datePreset !== "custom") {
    return { datePreset: range.datePreset };
  }

  return {
    since: customSince || range.since,
    until: customUntil || range.until,
  };
}

function formatDisplayDate(isoDate: string): string {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

export function getDateRangeDisplayLabel(
  filter: QuickDateFilter,
  customSince?: string,
  customUntil?: string,
): string {
  if (filter !== "custom" && PRESET_ONLY_FILTERS.includes(filter)) {
    return getQuickFilterLabel(filter);
  }

  const since = customSince?.trim();
  const until = customUntil?.trim();

  if (since && until) {
    if (since === until) {
      return formatDisplayDate(since);
    }
    return `${formatDisplayDate(since)} – ${formatDisplayDate(until)}`;
  }

  return getQuickFilterLabel(filter);
}

export function applyQuickDateFilter(
  filters: { search: string; status: string; objective: string },
  filter: QuickDateFilter,
): {
  search: string;
  status: string;
  objective: string;
  quickDateFilter: QuickDateFilter;
  since: string;
  until: string;
} {
  const range = getDateRangeForQuickFilter(filter);
  return {
    ...filters,
    quickDateFilter: filter,
    since: range.since,
    until: range.until,
  };
}
