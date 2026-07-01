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
  const range = getDateRangeForQuickFilter(filter);
  const since = customSince || range.since;
  const until = customUntil || range.until;

  if (filter === "last_7_days") {
    return "Son 7 gün";
  }
  if (filter === "last_30_days") {
    return "Son 30 gün";
  }
  if (since && until) {
    if (since === until) {
      return formatDisplayDate(since);
    }
    return `${formatDisplayDate(since)} – ${formatDisplayDate(until)}`;
  }

  return getQuickFilterLabel(filter);
}
