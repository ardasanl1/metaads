import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function PageContainer({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("mx-auto w-full space-y-6", wide ? "max-w-[1400px]" : "max-w-6xl", className)}>
      {children}
    </div>
  );
}
