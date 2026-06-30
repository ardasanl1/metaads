export function metaStatusColor(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") return "bg-green-100 text-green-800";
  if (normalized.includes("PAUSED")) return "bg-yellow-100 text-yellow-800";
  if (normalized.includes("DELETED") || normalized.includes("ARCHIVED")) {
    return "bg-gray-100 text-gray-600";
  }
  if (normalized.includes("PENDING") || normalized.includes("REVIEW")) {
    return "bg-blue-100 text-blue-800";
  }
  return "bg-gray-100 text-gray-800";
}

export function formatMetaDate(value: string): string {
  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return value;
  }
}

export function dailyBudgetFromMeta(value?: string): string {
  if (!value) return "—";
  const amount = Number(value) / 100;
  return `₺${amount.toLocaleString("tr-TR")}`;
}
