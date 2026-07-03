"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import PanelLayout from "@/components/PanelLayout";
import { CampaignTable } from "@/components/campaigns/CampaignTable";
import { CampaignFiltersBar } from "@/components/campaigns/CampaignFilters";
import { CampaignEmptyState } from "@/components/campaigns/CampaignEmptyState";
import { DataDateRangeCaption } from "@/components/cards/DataDateRangeCaption";
import { SectionCard } from "@/components/shared/SectionCard";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { useCampaigns } from "@/hooks/use-campaigns";

function CampaignsBody() {
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
    allCampaigns,
    filters,
    setFilters,
    loading: campaignsLoading,
    error: campaignsError,
    reload,
    sortField,
    sortDirection,
    toggleSort,
  } = useCampaigns(accountKey, isReady);

  const displayError = error ?? campaignsError;
  const loading = accountLoading || campaignsLoading;
  const showEmpty = isReady && !loading && allCampaigns.length === 0;

  return (
    <>
      {!accountLoading && status && !status.connected && (
        <SectionCard title="Meta bağlantısı gerekli" description="Kampanyaları görmek için hesabınızı bağlayın.">
          <Button asChild>
            <Link href="/settings">Ayarlara Git</Link>
          </Button>
        </SectionCard>
      )}

      {!accountLoading && status?.connected && !isReady && (
        <SectionCard title="Reklam hesabı seçin" description="Kampanyaları listelemek için reklam hesabı ekleyin.">
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

      {isReady && (
        <SectionCard noPadding contentClassName="p-4 sm:p-5">
          <CampaignFiltersBar filters={filters} campaigns={allCampaigns} onChange={setFilters} />
        </SectionCard>
      )}

      {showEmpty ? (
        <CampaignEmptyState />
      ) : (
        <SectionCard title="Kampanya Listesi" noPadding>
          <CampaignTable
            campaigns={campaigns}
            loading={loading}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={toggleSort}
          />
          {isReady && !loading && (
            <div className="border-t border-border px-4 py-3 sm:px-6">
              <DataDateRangeCaption
                filter={filters.quickDateFilter}
                since={filters.since}
                until={filters.until}
                accountName={selectedAdAccountName}
              />
            </div>
          )}
        </SectionCard>
      )}
    </>
  );
}

export default function CampaignsContent() {
  return (
    <PanelLayout
      title="Kampanyalar"
      subtitle="Tüm kampanyalarınızı yönetin ve performansı izleyin"
      wide
      actions={
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />
            Yeni Kampanya
          </Link>
        </Button>
      }
    >
      <CampaignsBody />
    </PanelLayout>
  );
}
