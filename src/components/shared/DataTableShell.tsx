import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

type DataTableShellProps = {
  children: ReactNode;
  className?: string;
};

export function DataTableShell({ children, className }: DataTableShellProps) {
  return (
    <div className={cn("panel-card overflow-hidden", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
