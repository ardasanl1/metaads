"use client";

import { Button } from "@/components/ui/button";
import { StatsGrid } from "@/components/cards/StatsGrid";
import { DataDateRangeCaption } from "@/components/cards/DataDateRangeCaption";
import { useAccountInsights } from "@/hooks/use-account-insights";
import { useMetaAccount } from "@/hooks/use-meta-account";
import type { DateFilterState } from "@/hooks/use-date-filter";

type DashboardStatsProps = {
  dateFilter: DateFilterState;
};

export function DashboardStats({ dateFilter }: DashboardStatsProps) {
  const { accountKey, isReady, selectedAdAccountName, error, retry } = useMetaAccount();
  const { insights, loading, error: insightsError, reload } = useAccountInsights(
    accountKey,
    isReady,
    dateFilter,
  );

  const displayError = error ?? insightsError;

  return (
    <div className="space-y-3">
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
      {isReady && (
        <DataDateRangeCaption
          filter={dateFilter.quickDateFilter}
          since={dateFilter.since}
          until={dateFilter.until}
          accountName={selectedAdAccountName}
        />
      )}
    </div>
  );
}
