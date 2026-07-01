"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QuickDateFilter } from "@/types/meta";
import { applyQuickDateFilter, getQuickFilterLabel } from "@/utils/date-ranges";
import type { DateFilterState } from "@/hooks/use-date-filter";

const QUICK_FILTERS: QuickDateFilter[] = [
  "today",
  "yesterday",
  "last_7_days",
  "last_14_days",
  "this_month",
  "last_month",
];

type QuickDateFilterBarProps = {
  value: DateFilterState;
  onChange: (value: DateFilterState) => void;
  className?: string;
};

export function QuickDateFilterBar({ value, onChange }: QuickDateFilterBarProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-2 sm:max-w-md">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Başlangıç</label>
          <Input
            type="date"
            value={value.since}
            onChange={(event) =>
              onChange({
                ...value,
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
            value={value.until}
            onChange={(event) =>
              onChange({
                ...value,
                until: event.target.value,
                quickDateFilter: "custom",
              })
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((filter) => (
          <Button
            key={filter}
            type="button"
            size="sm"
            variant={value.quickDateFilter === filter ? "default" : "outline"}
            onClick={() => {
              const next = applyQuickDateFilter(
                { search: "", status: "all", objective: "all" },
                filter,
              );
              onChange({
                quickDateFilter: next.quickDateFilter,
                since: next.since,
                until: next.until,
              });
            }}
          >
            {getQuickFilterLabel(filter)}
          </Button>
        ))}
      </div>
    </div>
  );
}
