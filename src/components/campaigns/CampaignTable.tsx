"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CampaignSortField, CampaignWithInsights, SortDirection } from "@/types/meta";
import { formatCurrency, formatNumber, formatPercent, formatRoas, centsToCurrency } from "@/utils/format";
import { formatMetaDate } from "@/lib/status-utils";
import { getObjectiveLabel } from "@/utils/campaign-constants";
import { formatMetaStatusLabel } from "@/utils/status-labels";

function SortIcon({
  field,
  activeField,
  direction,
}: {
  field: CampaignSortField;
  activeField: CampaignSortField;
  direction: SortDirection;
}) {
  if (activeField !== field) {
    return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
  }
  return direction === "asc" ? (
    <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
  ) : (
    <ArrowDown className="ml-1 inline h-3.5 w-3.5" />
  );
}

function statusVariant(status: string): "success" | "warning" | "muted" | "secondary" {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") return "success";
  if (normalized.includes("PAUSED")) return "warning";
  return "muted";
}

type CampaignTableProps = {
  campaigns: CampaignWithInsights[];
  loading?: boolean;
  sortField: CampaignSortField;
  sortDirection: SortDirection;
  onSort: (field: CampaignSortField) => void;
};

export function CampaignTable({
  campaigns,
  loading = false,
  sortField,
  sortDirection,
  onSort,
}: CampaignTableProps) {
  if (loading) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const sortableHeader = (label: string, field: CampaignSortField) => (
    <button
      type="button"
      className="inline-flex items-center font-medium text-muted-foreground hover:text-foreground"
      onClick={() => onSort(field)}
    >
      {label}
      <SortIcon field={field} activeField={sortField} direction={sortDirection} />
    </button>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kampanya</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hedef</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              {sortableHeader("Günlük Bütçe", "budget")}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              {sortableHeader("Harcama", "spend")}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              {sortableHeader("Satın Alma", "purchases")}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Satın Alma Değeri</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              {sortableHeader("ROAS", "roas")}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              {sortableHeader("Tıklama Oranı", "ctr")}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Gösterim B. Maliyet</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sıklık</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Son Güncelleme</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Yönet</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {campaigns.map((campaign) => {
            const dailyBudget = centsToCurrency(campaign.daily_budget);
            const lifetimeBudget = centsToCurrency(campaign.lifetime_budget);
            const budgetLabel =
              dailyBudget !== null
                ? formatCurrency(dailyBudget)
                : lifetimeBudget !== null
                  ? `${formatCurrency(lifetimeBudget)} (toplam)`
                  : "—";

            return (
              <tr key={campaign.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{campaign.name}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(campaign.status)}>
                    {formatMetaStatusLabel(campaign.status)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {getObjectiveLabel(campaign.objective)}
                </td>
                <td className="px-4 py-3">{budgetLabel}</td>
                <td className="px-4 py-3">{formatCurrency(campaign.insights.spend)}</td>
                <td className="px-4 py-3">{formatNumber(campaign.insights.purchases, 0)}</td>
                <td className="px-4 py-3">{formatCurrency(campaign.insights.purchaseValue)}</td>
                <td className="px-4 py-3">{formatRoas(campaign.insights.roas)}</td>
                <td className="px-4 py-3">{formatPercent(campaign.insights.ctr)}</td>
                <td className="px-4 py-3">{formatCurrency(campaign.insights.cpm)}</td>
                <td className="px-4 py-3">{formatNumber(campaign.insights.frequency, 2)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatMetaDate(campaign.updated_time)}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/campaigns/${campaign.id}`} className="text-primary hover:underline">
                    Yönet
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
