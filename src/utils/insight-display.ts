import type { ParsedInsights } from "@/types/meta";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
} from "@/utils/format";

export function formatInsightValue(
  insights: ParsedInsights | null | undefined,
  key: keyof ParsedInsights,
  formatter: (value: number) => string,
): string {
  if (!insights) return "—";
  return formatter(insights[key]);
}

export const INSIGHT_COLUMNS = [
  { key: "spend" as const, label: "Spend", format: formatCurrency },
  { key: "purchases" as const, label: "Purchases", format: (v: number) => formatNumber(v, 0) },
  { key: "purchaseValue" as const, label: "Purchase Value", format: formatCurrency },
  { key: "roas" as const, label: "ROAS", format: formatRoas },
  { key: "ctr" as const, label: "CTR", format: formatPercent },
  { key: "cpc" as const, label: "CPC", format: formatCurrency },
  { key: "cpm" as const, label: "CPM", format: formatCurrency },
  { key: "frequency" as const, label: "Frequency", format: (v: number) => formatNumber(v, 2) },
] as const;
