"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Business } from "@/types/meta";

type BusinessSelectorProps = {
  businesses: Business[];
  value: string | null;
  onChange: (businessId: string) => void;
  loading?: boolean;
};

export function BusinessSelector({
  businesses,
  value,
  onChange,
  loading = false,
}: BusinessSelectorProps) {
  if (loading) {
    return <Skeleton className="h-9 w-full sm:w-56" />;
  }

  if (businesses.length <= 1) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:w-56">
      <label className="text-xs font-medium text-muted-foreground">Business</label>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Business seçin" />
        </SelectTrigger>
        <SelectContent>
          {businesses.map((business) => (
            <SelectItem key={business.id} value={business.id}>
              {business.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
