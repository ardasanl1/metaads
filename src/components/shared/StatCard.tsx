import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";

type StatCardProps = {
  label: string;
  value: string;
  description?: string;
  icon?: LucideIcon;
  trend?: string;
  loading?: boolean;
  className?: string;
};

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  trend,
  loading = false,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden border-border shadow-[var(--shadow-soft)]", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-28" />
            ) : (
              <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
            )}
            {description && !loading && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
            {trend && !loading && (
              <p className="mt-2 text-xs font-medium text-primary">{trend}</p>
            )}
          </div>
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
