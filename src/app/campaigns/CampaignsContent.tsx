"use client";

import Link from "next/link";
import PanelLayout from "@/components/PanelLayout";
import { CampaignTable } from "@/components/campaigns/CampaignTable";
import { CampaignFiltersBar } from "@/components/campaigns/CampaignFilters";
import { CampaignEmptyState } from "@/components/campaigns/CampaignEmptyState";
import { Button } from "@/components/ui/button";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { useCampaigns } from "@/hooks/use-campaigns";

function CampaignsBody() {
  const { isReady, status, accountKey, error, retry, loading: accountLoading } = useMetaAccount();
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
    <div className="space-y-4">
      <div className="flex justify-end">
        {isReady ? (
          <Button asChild>
            <Link href="/campaigns/new">Yeni Kampanya</Link>
          </Button>
        ) : (
          <Button disabled title="Önce Meta hesabını bağlayın ve reklam hesabı seçin">
            Yeni Kampanya
          </Button>
        )}
      </div>

      {!accountLoading && status && !status.connected && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-950/30 sm:p-6">
          <p className="text-sm text-yellow-900 dark:text-yellow-200">
            Gerçek kampanyaları görmek için Meta hesabını bağla.
          </p>
          <Button asChild className="mt-3">
            <Link href="/settings/integrations">Entegrasyonlara Git</Link>
          </Button>
        </div>
      )}

      {!accountLoading && status?.connected && !isReady && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-950/30 sm:p-6">
          <p className="text-sm text-yellow-900 dark:text-yellow-200">
            Kampanyaları görmek için bir reklam hesabı seçin.
          </p>
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
        <CampaignFiltersBar filters={filters} campaigns={allCampaigns} onChange={setFilters} />
      )}

      {showEmpty ? (
        <CampaignEmptyState />
      ) : (
        <CampaignTable
          campaigns={campaigns}
          loading={loading}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={toggleSort}
        />
      )}
    </div>
  );
}

export default function CampaignsContent() {
  return (
    <PanelLayout title="Kampanyalar">
      <CampaignsBody />
    </PanelLayout>
  );
}
