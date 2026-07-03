"use client";

import Link from "next/link";
import { useMemo } from "react";
import { HelpCircle } from "lucide-react";
import PanelLayout from "@/components/PanelLayout";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { CampaignTable } from "@/components/campaigns/CampaignTable";
import { DataDateRangeCaption } from "@/components/cards/DataDateRangeCaption";
import { QuickDateFilterBar } from "@/components/filters/QuickDateFilterBar";
import { SectionCard } from "@/components/shared/SectionCard";
import { ErrorState } from "@/components/shared/ErrorState";
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
    <>
      {!accountLoading && status && !status.connected && (
        <SectionCard title="Meta bağlantısı gerekli" description="Özet verileri görmek için hesabınızı bağlayın.">
          <Button asChild>
            <Link href="/settings">Ayarlara Git</Link>
          </Button>
        </SectionCard>
      )}

      {!accountLoading && status?.connected && !isReady && (
        <SectionCard
          title="Reklam hesabı seçin"
          description="Özet verileri görmek için bir reklam hesabı ekleyin ve seçin."
        >
          <Button asChild variant="outline">
            <Link href="/settings">Ayarlara Git</Link>
          </Button>
        </SectionCard>
      )}

      {displayError && (
        <ErrorState
          message={displayError}
          onRetry={() => {
            retry();
            void reload();
          }}
        />
      )}

      {isReady && <QuickDateFilterBar value={dateFilterState} onChange={setState} />}

      <DashboardStats dateFilter={dateFilterState} />

      <SectionCard title="Son Kampanyalar" description="Seçili hesaptaki en güncel kampanyalar">
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
            className="mt-3"
          />
        )}
      </SectionCard>
    </>
  );
}

export default function DashboardContent() {
  return (
    <PanelLayout
      title="Genel Bakış"
      subtitle="Reklam performansınızı tek ekranda izleyin"
      wide
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings">
            <HelpCircle className="mr-2 h-4 w-4" />
            Yardım
          </Link>
        </Button>
      }
    >
      <DashboardBody />
    </PanelLayout>
  );
}
