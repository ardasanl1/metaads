"use client";

import { Button } from "@/components/ui/button";
import { StatsGrid } from "@/components/cards/StatsGrid";
import { useAccountInsights } from "@/hooks/use-account-insights";
import { useMetaAccount } from "@/hooks/use-meta-account";
import type { QuickDateFilter } from "@/types/meta";

type DashboardStatsProps = {
  quickFilter?: QuickDateFilter;
};

export function DashboardStats({ quickFilter = "last_7_days" }: DashboardStatsProps) {
  const { accountKey, isReady, error, retry } = useMetaAccount();
  const { insights, loading, error: insightsError, reload } = useAccountInsights(
    accountKey,
    isReady,
    quickFilter,
  );

  const displayError = error ?? insightsError;

  return (
    <div className="space-y-4">
      {displayError && (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive">{displayError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              retry();
              void reload();
            }}
          >
            Tekrar Dene
          </Button>
        </div>
      )}
      <StatsGrid insights={insights} loading={loading || !isReady} />
    </div>
  );
}
