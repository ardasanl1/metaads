import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";

type LoadingStateProps = {
  rows?: number;
  className?: string;
};

export function LoadingState({ rows = 4, className }: LoadingStateProps) {
  return (
    <div className={cn("panel-section space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}
