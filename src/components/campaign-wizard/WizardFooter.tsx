"use client";

import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

type WizardFooterProps = {
  children: ReactNode;
  className?: string;
};

export function WizardFooter({ children, className }: WizardFooterProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border/60 bg-page/95 px-4 py-4 backdrop-blur sm:-mx-0 sm:px-0",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3">{children}</div>
    </div>
  );
}
