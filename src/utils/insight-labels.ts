import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
} from "@/utils/format";
import type { ParsedInsights } from "@/types/meta";

export const INSIGHT_METRIC_LABELS: Record<
  | "spend"
  | "purchases"
  | "purchaseValue"
  | "roas"
  | "ctr"
  | "cpc"
  | "cpm"
  | "reach"
  | "impressions"
  | "frequency",
  string
> = {
  spend: "Harcama",
  purchases: "Satın Alma",
  purchaseValue: "Satın Alma Değeri",
  roas: "ROAS",
  ctr: "Tıklama Oranı",
  cpc: "Tıklama Başı Maliyet",
  cpm: "Gösterim Başı Maliyet",
  reach: "Erişim",
  impressions: "Gösterim",
  frequency: "Sıklık",
};

export const DASHBOARD_STAT_ITEMS: Array<{
  key: keyof ParsedInsights;
  label: string;
  format: (value: number) => string;
}> = [
  { key: "spend", label: INSIGHT_METRIC_LABELS.spend, format: formatCurrency },
  { key: "purchases", label: INSIGHT_METRIC_LABELS.purchases, format: (v) => formatNumber(v, 0) },
  { key: "purchaseValue", label: INSIGHT_METRIC_LABELS.purchaseValue, format: formatCurrency },
  { key: "roas", label: INSIGHT_METRIC_LABELS.roas, format: formatRoas },
  { key: "ctr", label: INSIGHT_METRIC_LABELS.ctr, format: formatPercent },
  { key: "cpc", label: INSIGHT_METRIC_LABELS.cpc, format: formatCurrency },
  { key: "cpm", label: INSIGHT_METRIC_LABELS.cpm, format: formatCurrency },
  { key: "reach", label: INSIGHT_METRIC_LABELS.reach, format: (v) => formatNumber(v, 0) },
  { key: "impressions", label: INSIGHT_METRIC_LABELS.impressions, format: (v) => formatNumber(v, 0) },
];

export const CAMPAIGN_DETAIL_STAT_ITEMS: Array<{
  key: keyof ParsedInsights;
  label: string;
  format: (value: number) => string;
}> = [
  ...DASHBOARD_STAT_ITEMS,
  { key: "frequency", label: INSIGHT_METRIC_LABELS.frequency, format: (v) => formatNumber(v, 2) },
];
