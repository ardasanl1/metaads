import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  technicalDetail?: string;
  className?: string;
};

export function ErrorState({
  title = "Bir hata oluştu",
  message,
  onRetry,
  technicalDetail,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("panel-section border-destructive/20 bg-destructive/5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            {technicalDetail && (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Teknik detay</summary>
                <pre className="mt-1 whitespace-pre-wrap">{technicalDetail}</pre>
              </details>
            )}
          </div>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Tekrar Dene
          </Button>
        )}
      </div>
    </div>
  );
}
