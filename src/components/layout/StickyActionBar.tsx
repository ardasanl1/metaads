import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

type StickyActionBarProps = {
  children: ReactNode;
  className?: string;
};

export function StickyActionBar({ children, className }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 border-t border-border bg-card/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:-mx-6 sm:px-6",
        className,
      )}
    >
      <div className="mx-auto flex max-w-3xl gap-3">{children}</div>
    </div>
  );
}
