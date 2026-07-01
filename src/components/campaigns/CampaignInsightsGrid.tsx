"use client";

import type { ParsedInsights } from "@/types/meta";
import { StatCard } from "@/components/cards/StatCard";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
} from "@/utils/format";

type CampaignInsightsGridProps = {
  insights: ParsedInsights | null;
  loading?: boolean;
};

const STAT_ITEMS: Array<{
  key: keyof ParsedInsights;
  label: string;
  format: (value: number) => string;
}> = [
  { key: "spend", label: "Spend", format: formatCurrency },
  { key: "purchases", label: "Purchases", format: (value) => formatNumber(value, 0) },
  { key: "purchaseValue", label: "Purchase Value", format: formatCurrency },
  { key: "roas", label: "ROAS", format: formatRoas },
  { key: "ctr", label: "CTR", format: formatPercent },
  { key: "cpc", label: "CPC", format: formatCurrency },
  { key: "cpm", label: "CPM", format: formatCurrency },
  { key: "reach", label: "Reach", format: (value) => formatNumber(value, 0) },
  { key: "impressions", label: "Impressions", format: (value) => formatNumber(value, 0) },
  { key: "frequency", label: "Frequency", format: (value) => formatNumber(value, 2) },
];

export function CampaignInsightsGrid({ insights, loading = false }: CampaignInsightsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {STAT_ITEMS.map((item) => (
        <StatCard
          key={item.key}
          label={item.label}
          value={insights ? item.format(insights[item.key]) : "—"}
          loading={loading}
        />
      ))}
    </div>
  );
}
