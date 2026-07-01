import { CalendarRange } from "lucide-react";
import type { QuickDateFilter } from "@/types/meta";
import { getDateRangeDisplayLabel } from "@/utils/date-ranges";
import { cn } from "@/utils/cn";

type DataDateRangeCaptionProps = {
  filter: QuickDateFilter;
  since?: string;
  until?: string;
  accountName?: string | null;
  className?: string;
};

export function DataDateRangeCaption({
  filter,
  since,
  until,
  accountName,
  className,
}: DataDateRangeCaptionProps) {
  const rangeLabel = getDateRangeDisplayLabel(filter, since, until);

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <CalendarRange className="h-3.5 w-3.5 shrink-0" />
      <span>
        Veriler{" "}
        <span className="font-medium text-foreground">{rangeLabel}</span>
        {accountName ? (
          <>
            {" "}
            aralığında · <span className="font-medium text-foreground">{accountName}</span>
          </>
        ) : null}{" "}
        reklam hesabı için Meta API üzerinden çekilmektedir.
      </span>
    </p>
  );
}
