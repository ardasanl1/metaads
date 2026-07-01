"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdAccount } from "@/types/meta";

type AdAccountSelectorProps = {
  adAccounts: AdAccount[];
  value: string | null;
  onChange: (adAccountId: string) => void;
  loading?: boolean;
};

export function AdAccountSelector({
  adAccounts,
  value,
  onChange,
  loading = false,
}: AdAccountSelectorProps) {
  if (loading) {
    return <Skeleton className="h-9 w-full sm:w-64" />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:w-64">
      <label className="text-xs font-medium text-muted-foreground">Ad Account</label>
      <Select value={value ?? undefined} onValueChange={onChange} disabled={adAccounts.length === 0}>
        <SelectTrigger>
          <SelectValue placeholder="Reklam hesabı seçin" />
        </SelectTrigger>
        <SelectContent>
          {adAccounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
