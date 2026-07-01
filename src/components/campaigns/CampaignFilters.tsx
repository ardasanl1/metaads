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
import { getQuickFilterLabel } from "@/utils/date-ranges";
import { getUniqueObjectives, getUniqueStatuses } from "@/utils/campaign-filters";

const QUICK_FILTERS: QuickDateFilter[] = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
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
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <Input
            placeholder="Kampanya ara..."
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
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
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Objective</label>
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
                  {objective}
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
                onChange({ ...filters, since: event.target.value, quickDateFilter: "last_7_days" })
              }
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Bitiş</label>
            <Input
              type="date"
              value={filters.until}
              onChange={(event) =>
                onChange({ ...filters, until: event.target.value, quickDateFilter: "last_7_days" })
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
            onClick={() => onChange({ ...filters, quickDateFilter: filter })}
          >
            {getQuickFilterLabel(filter)}
          </Button>
        ))}
      </div>
    </div>
  );
}
