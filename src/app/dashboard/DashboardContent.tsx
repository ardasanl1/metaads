"use client";

import Link from "next/link";
import { useMemo } from "react";
import PanelLayout from "@/components/PanelLayout";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { CampaignTable } from "@/components/campaigns/CampaignTable";
import { DataDateRangeCaption } from "@/components/cards/DataDateRangeCaption";
import { QuickDateFilterBar } from "@/components/filters/QuickDateFilterBar";
import { Button } from "@/components/ui/button";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useDateFilter } from "@/hooks/use-date-filter";

function DashboardBody() {
  const { quickDateFilter, since, until, setState } = useDateFilter();
  const dateFilterState = useMemo(
    () => ({ quickDateFilter, since, until }),
    [quickDateFilter, since, until],
  );

  const {
    isReady,
    status,
    accountKey,
    selectedAdAccountName,
    error,
    retry,
    loading: accountLoading,
  } = useMetaAccount();
  const {
    campaigns,
    loading: campaignsLoading,
    error: campaignsError,
    reload,
    sortField,
    sortDirection,
    toggleSort,
  } = useCampaigns(accountKey, isReady, dateFilterState);

  const recentCampaigns = campaigns.slice(0, 5);
  const displayError = error ?? campaignsError;
  const loading = accountLoading || campaignsLoading;

  return (
    <div className="space-y-6">
      {!accountLoading && status && !status.connected && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Özet verileri görmek için Meta hesabını bağlayın.{" "}
          <Link href="/settings" className="text-primary hover:underline">
            Ayarlara git
          </Link>
        </div>
      )}

      {!accountLoading && status?.connected && !isReady && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-950/30 sm:p-6">
          <p className="text-sm text-yellow-900 dark:text-yellow-200">
            Özet verileri görmek için Ayarlar sayfasından reklam hesabı ekleyin ve seçin.
          </p>
          <Button asChild className="mt-3" variant="outline" size="sm">
            <Link href="/settings">Ayarlara Git</Link>
          </Button>
        </div>
      )}

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

      {isReady && (
        <QuickDateFilterBar value={dateFilterState} onChange={setState} />
      )}

      <DashboardStats dateFilter={dateFilterState} />

      <div>
        <h2 className="mb-3 text-base font-semibold">Son Kampanyalar</h2>
        <div className="space-y-2">
          <CampaignTable
            key={`${dateFilterState.quickDateFilter}-${dateFilterState.since}-${dateFilterState.until}-${accountKey}`}
            campaigns={recentCampaigns}
            loading={loading || !isReady}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={toggleSort}
          />
          {isReady && !loading && (
            <DataDateRangeCaption
              filter={dateFilterState.quickDateFilter}
              since={dateFilterState.since}
              until={dateFilterState.until}
              accountName={selectedAdAccountName}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardContent() {
  return (
    <PanelLayout title="Genel Bakış">
      <DashboardBody />
    </PanelLayout>
  );
}
