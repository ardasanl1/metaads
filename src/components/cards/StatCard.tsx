import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";

type StatCardProps = {
  label: string;
  value: string;
  loading?: boolean;
  className?: string;
};

export function StatCard({ label, value, loading = false, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-24" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
