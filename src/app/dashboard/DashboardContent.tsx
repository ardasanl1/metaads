"use client";

import Link from "next/link";
import PanelLayout from "@/components/PanelLayout";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { CampaignTable } from "@/components/campaigns/CampaignTable";
import { Button } from "@/components/ui/button";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { useCampaigns } from "@/hooks/use-campaigns";

function DashboardBody() {
  const { isReady, status, accountKey, error, retry, loading: accountLoading } = useMetaAccount();
  const {
    campaigns,
    loading: campaignsLoading,
    error: campaignsError,
    reload,
    sortField,
    sortDirection,
    toggleSort,
  } = useCampaigns(accountKey, isReady);

  const recentCampaigns = campaigns.slice(0, 5);
  const displayError = error ?? campaignsError;
  const loading = accountLoading || campaignsLoading;

  return (
    <div className="space-y-6">
      {!accountLoading && status && !status.connected && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Özet verileri görmek için Meta hesabını bağlayın.{" "}
          <Link href="/settings/integrations" className="text-primary hover:underline">
            Entegrasyonlara git
          </Link>
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

      <DashboardStats quickFilter="last_7_days" />

      <div>
        <h2 className="mb-3 text-base font-semibold">Son Kampanyalar</h2>
        <CampaignTable
          campaigns={recentCampaigns}
          loading={loading || !isReady}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={toggleSort}
        />
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
