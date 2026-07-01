"use client";

import type { ParsedInsights } from "@/types/meta";
import { StatCard } from "@/components/cards/StatCard";
import { CAMPAIGN_DETAIL_STAT_ITEMS } from "@/utils/insight-labels";

type CampaignInsightsGridProps = {
  insights: ParsedInsights | null;
  loading?: boolean;
};

export function CampaignInsightsGrid({ insights, loading = false }: CampaignInsightsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {CAMPAIGN_DETAIL_STAT_ITEMS.map((item) => (
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
