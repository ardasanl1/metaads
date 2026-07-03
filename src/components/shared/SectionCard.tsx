import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

type SectionCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
};

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  noPadding,
}: SectionCardProps) {
  return (
    <section className={cn("panel-card overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && children !== undefined && "p-5 sm:p-6", contentClassName)}>
        {children}
      </div>
    </section>
  );
}
