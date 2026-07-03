import { Badge } from "@/components/ui/badge";
import { formatMetaStatusLabel } from "@/utils/status-labels";

type CampaignStatus = "ACTIVE" | "PAUSED" | "ARCHIVED" | "ERROR" | string;

function variantFor(status: string): "success" | "warning" | "muted" | "destructive" | "secondary" {
  const n = status.toUpperCase();
  if (n === "ACTIVE") return "success";
  if (n.includes("PAUSED")) return "warning";
  if (n === "ARCHIVED" || n.includes("DELETED")) return "muted";
  if (n === "ERROR" || n.includes("DISAPPROVED")) return "destructive";
  return "secondary";
}

export function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <Badge variant={variantFor(status)} className="font-medium">
      {formatMetaStatusLabel(status)}
    </Badge>
  );
}
