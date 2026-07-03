"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CampaignFilters, CampaignWithInsights, QuickDateFilter } from "@/types/meta";
import { applyQuickDateFilter, getQuickFilterLabel } from "@/utils/date-ranges";
import { getObjectiveLabel } from "@/utils/campaign-constants";
import { getUniqueObjectives, getUniqueStatuses } from "@/utils/campaign-filters";
import { formatMetaStatusLabel } from "@/utils/status-labels";

const QUICK_FILTERS: QuickDateFilter[] = [
  "today",
  "yesterday",
  "last_7_days",
  "last_14_days",
  "this_month",
  "last_month",
];

type CampaignFiltersBarProps = {
  filters: CampaignFilters;
  campaigns: CampaignWithInsights[];
  onChange: (filters: CampaignFilters) => void;
};

export function CampaignFiltersBar({ filters, campaigns, onChange }: CampaignFiltersBarProps) {
  const statuses = getUniqueStatuses(campaigns);
  const objectives = getUniqueObjectives(campaigns);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Ara</label>
          <Input
            placeholder="Kampanya ara..."
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Durum</label>
          <Select
            value={filters.status}
            onValueChange={(status) => onChange({ ...filters, status })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {formatMetaStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Hedef</label>
          <Select
            value={filters.objective}
            onValueChange={(objective) => onChange({ ...filters, objective })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {objectives.map((objective) => (
                <SelectItem key={objective} value={objective}>
                  {getObjectiveLabel(objective)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Başlangıç</label>
            <Input
              type="date"
              value={filters.since}
              onChange={(event) =>
                onChange({
                  ...filters,
                  since: event.target.value,
                  quickDateFilter: "custom",
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Bitiş</label>
            <Input
              type="date"
              value={filters.until}
              onChange={(event) =>
                onChange({
                  ...filters,
                  until: event.target.value,
                  quickDateFilter: "custom",
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((filter) => (
          <Button
            key={filter}
            type="button"
            size="sm"
            variant={filters.quickDateFilter === filter ? "default" : "outline"}
            onClick={() =>
              onChange(
                applyQuickDateFilter(
                  {
                    search: filters.search,
                    status: filters.status,
                    objective: filters.objective,
                  },
                  filter,
                ),
              )
            }
          >
            {getQuickFilterLabel(filter)}
          </Button>
        ))}
      </div>
    </div>
  );
}
