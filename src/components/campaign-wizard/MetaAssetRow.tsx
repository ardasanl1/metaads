"use client";

import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

export type MetaAssetStatus = "found" | "manual" | "missing" | "loading" | "optional";

function statusLabel(status: MetaAssetStatus): string {
  switch (status) {
    case "found":
      return "Otomatik bulundu";
    case "manual":
      return "Manuel tanımlandı";
    case "missing":
      return "Bulunamadı";
    case "loading":
      return "Doğrulanıyor";
    case "optional":
      return "Opsiyonel";
  }
}

function statusVariant(status: MetaAssetStatus): "success" | "secondary" | "warning" | "muted" | "outline" {
  switch (status) {
    case "found":
      return "success";
    case "manual":
      return "secondary";
    case "missing":
      return "warning";
    case "loading":
      return "outline";
    case "optional":
      return "muted";
  }
}

type MetaAssetRowProps = {
  icon: LucideIcon;
  label: string;
  value?: string;
  emptyValueText?: string;
  status: MetaAssetStatus;
  onChange?: () => void;
  changeLabel?: string;
  className?: string;
};

export function MetaAssetRow({
  icon: Icon,
  label,
  value,
  emptyValueText = "—",
  status,
  onChange,
  changeLabel = "Değiştir",
  className,
}: MetaAssetRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-border/50 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">
            {value || emptyValueText}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
        <Badge variant={statusVariant(status)} className="font-normal">
          {statusLabel(status)}
        </Badge>
        {onChange && (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onChange}>
            {changeLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
