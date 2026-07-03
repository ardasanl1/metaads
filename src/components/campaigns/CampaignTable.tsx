"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { CampaignSortField, CampaignWithInsights, SortDirection } from "@/types/meta";
import { formatCurrency, formatNumber, formatPercent, formatRoas, centsToCurrency } from "@/utils/format";
import { formatMetaDate } from "@/lib/status-utils";
import { getObjectiveLabel } from "@/utils/campaign-constants";

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
      <div className="space-y-3 p-4 sm:p-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const sortableHeader = (label: string, field: CampaignSortField) => (
    <button
      type="button"
      className="inline-flex items-center font-medium text-muted-foreground transition-colors hover:text-foreground"
      onClick={() => onSort(field)}
    >
      {label}
      <SortIcon field={field} activeField={sortField} direction={sortDirection} />
    </button>
  );

  return (
    <DataTableShell>
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="sticky top-0 z-[1] bg-muted/60 backdrop-blur">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground sm:px-6">Kampanya</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hedef</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              {sortableHeader("Günlük Bütçe", "budget")}
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              {sortableHeader("Harcama", "spend")}
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              {sortableHeader("Satın Alma", "purchases")}
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Satın Alma Değeri</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              {sortableHeader("ROAS", "roas")}
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              {sortableHeader("Tıklama Oranı", "ctr")}
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gösterim B. Maliyet</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Sıklık</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Son Güncelleme</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground sm:px-6">İşlem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
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
              <tr key={campaign.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-3 font-medium sm:px-6">
                  <Link href={`/campaigns/${campaign.id}`} className="hover:text-primary hover:underline">
                    {campaign.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={campaign.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {getObjectiveLabel(campaign.objective)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{budgetLabel}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(campaign.insights.spend)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatNumber(campaign.insights.purchases, 0)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCurrency(campaign.insights.purchaseValue)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatRoas(campaign.insights.roas)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPercent(campaign.insights.ctr)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(campaign.insights.cpm)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatNumber(campaign.insights.frequency, 2)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatMetaDate(campaign.updated_time)}</td>
                <td className="px-4 py-3 text-right sm:px-6">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">İşlemler</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/campaigns/${campaign.id}`}>Detay</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTableShell>
  );
}
