"use client";

import { StatsGrid } from "@/components/cards/StatsGrid";
import { DataDateRangeCaption } from "@/components/cards/DataDateRangeCaption";
import { ErrorState } from "@/components/shared/ErrorState";
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
    <div className="space-y-4">
      {displayError && (
        <ErrorState
          message={displayError}
          onRetry={() => {
            retry();
            void reload();
          }}
        />
      )}
      <StatsGrid insights={insights} loading={loading || !isReady} />
      {isReady && !loading && (
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
