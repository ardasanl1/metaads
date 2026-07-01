import type {
  CampaignFilters,
  CampaignSortField,
  CampaignWithInsights,
  SortDirection,
} from "@/types/meta";
import { getDateRangeForQuickFilter } from "@/utils/date-ranges";
import { centsToCurrency } from "@/utils/format";

export function getDefaultCampaignFilters(): CampaignFilters {
  const range = getDateRangeForQuickFilter("last_7_days");
  return {
    search: "",
    status: "all",
    objective: "all",
    quickDateFilter: "last_7_days",
    since: range.since,
    until: range.until,
  };
}

export function filterCampaigns(
  campaigns: CampaignWithInsights[],
  filters: CampaignFilters,
): CampaignWithInsights[] {
  const search = filters.search.trim().toLowerCase();

  return campaigns.filter((campaign) => {
    if (search && !campaign.name.toLowerCase().includes(search)) {
      return false;
    }
    if (filters.status !== "all" && campaign.status !== filters.status) {
      return false;
    }
    if (filters.objective !== "all" && campaign.objective !== filters.objective) {
      return false;
    }
    return true;
  });
}

function getBudgetValue(campaign: CampaignWithInsights): number {
  return centsToCurrency(campaign.daily_budget) ?? centsToCurrency(campaign.lifetime_budget) ?? 0;
}

export function sortCampaigns(
  campaigns: CampaignWithInsights[],
  field: CampaignSortField,
  direction: SortDirection,
): CampaignWithInsights[] {
  const sorted = [...campaigns];
  const multiplier = direction === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    let aValue = 0;
    let bValue = 0;

    switch (field) {
      case "spend":
        aValue = a.insights.spend;
        bValue = b.insights.spend;
        break;
      case "roas":
        aValue = a.insights.roas;
        bValue = b.insights.roas;
        break;
      case "ctr":
        aValue = a.insights.ctr;
        bValue = b.insights.ctr;
        break;
      case "purchases":
        aValue = a.insights.purchases;
        bValue = b.insights.purchases;
        break;
      case "budget":
        aValue = getBudgetValue(a);
        bValue = getBudgetValue(b);
        break;
    }

    return (aValue - bValue) * multiplier;
  });

  return sorted;
}

export function getUniqueObjectives(campaigns: CampaignWithInsights[]): string[] {
  return [...new Set(campaigns.map((campaign) => campaign.objective))].sort();
}

export function getUniqueStatuses(campaigns: CampaignWithInsights[]): string[] {
  return [...new Set(campaigns.map((campaign) => campaign.status))].sort();
}
