const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  PAUSED: "Duraklatıldı",
  DELETED: "Silindi",
  ARCHIVED: "Arşivlendi",
  IN_PROCESS: "İşleniyor",
  WITH_ISSUES: "Sorunlu",
  PENDING_REVIEW: "İncelemede",
  DISAPPROVED: "Reddedildi",
  PREAPPROVED: "Ön Onaylı",
  PENDING_BILLING_INFO: "Fatura Bekliyor",
  CAMPAIGN_PAUSED: "Kampanya Duraklatıldı",
  ADSET_PAUSED: "Set Duraklatıldı",
};

export function formatMetaStatusLabel(status: string): string {
  const normalized = status.toUpperCase();
  if (STATUS_LABELS[normalized]) {
    return STATUS_LABELS[normalized];
  }
  if (normalized.includes("PAUSED")) return "Duraklatıldı";
  if (normalized.includes("ACTIVE")) return "Aktif";
  return status;
}
