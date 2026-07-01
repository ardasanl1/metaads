import type { ParsedInsights } from "@/types/meta";
import { INSIGHT_METRIC_LABELS } from "@/utils/insight-labels";
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
  { key: "spend" as const, label: INSIGHT_METRIC_LABELS.spend, format: formatCurrency },
  {
    key: "purchases" as const,
    label: INSIGHT_METRIC_LABELS.purchases,
    format: (v: number) => formatNumber(v, 0),
  },
  { key: "purchaseValue" as const, label: INSIGHT_METRIC_LABELS.purchaseValue, format: formatCurrency },
  { key: "roas" as const, label: INSIGHT_METRIC_LABELS.roas, format: formatRoas },
  { key: "ctr" as const, label: INSIGHT_METRIC_LABELS.ctr, format: formatPercent },
  { key: "cpc" as const, label: INSIGHT_METRIC_LABELS.cpc, format: formatCurrency },
  { key: "cpm" as const, label: INSIGHT_METRIC_LABELS.cpm, format: formatCurrency },
  {
    key: "frequency" as const,
    label: INSIGHT_METRIC_LABELS.frequency,
    format: (v: number) => formatNumber(v, 2),
  },
] as const;
