import type { DateRangePreset, QuickDateFilter } from "@/types/meta";

export type DateRange = {
  since: string;
  until: string;
  datePreset?: DateRangePreset;
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

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
    case "last_30_days":
      return { since: "", until: "", datePreset: "last_30d" };
    case "this_month":
      return {
        since: formatDate(startOfMonth(today)),
        until: todayStr,
        datePreset: "this_month",
      };
    default:
      return { since: "", until: "", datePreset: "last_7d" };
  }
}

export function getQuickFilterLabel(filter: QuickDateFilter): string {
  const labels: Record<QuickDateFilter, string> = {
    today: "Bugün",
    yesterday: "Dün",
    last_7_days: "Son 7 Gün",
    last_30_days: "Son 30 Gün",
    this_month: "Bu Ay",
  };
  return labels[filter];
}
