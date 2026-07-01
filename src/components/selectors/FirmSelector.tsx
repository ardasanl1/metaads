"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { MetaConnectionSummary } from "@/types/meta";
import { getFirmDisplayName } from "@/utils/ad-account";

type FirmSelectorProps = {
  connections: MetaConnectionSummary[];
  value: string | null;
  onChange: (connectionId: string) => void;
  loading?: boolean;
};

export function FirmSelector({
  connections,
  value,
  onChange,
  loading = false,
}: FirmSelectorProps) {
  if (loading) {
    return <Skeleton className="h-9 w-full sm:w-56" />;
  }

  if (connections.length === 0) {
    return null;
  }

  const selected = connections.find((connection) => connection.id === value);

  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:w-56">
      <label className="text-xs font-medium text-muted-foreground">İşletme</label>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="İşletme seçin">
            {selected ? getFirmDisplayName(selected) : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {connections.map((connection) => (
            <SelectItem key={connection.id} value={connection.id}>
              {getFirmDisplayName(connection)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
