import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

type TipCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  iconClassName?: string;
};

export function TipCard({ icon: Icon, title, description, iconClassName }: TipCardProps) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconClassName)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
